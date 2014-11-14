var SpellCheck = require("spellcheck"),
    async = require("async"),
    path = require("path"),
    Promise = require("promise"),
    Queue = require("promise-queue");

Queue.configure(Promise);

var queue = new Queue(5, Infinity),
    viewableAttribs = ['title', 'alt'],
    spell,
    api = {
        name: 'hunspell',
        on: ['dom'],
        filter: ['text', 'tag']
    };

api.lint = function (element, opts) {
    var enabled = !!opts[api.name],
        dictionary = opts[api.name].dictionary ||
            path.join(__dirname, "..", "bin", "en_US.dic"),
        affix = opts[api.name].affix ||
            path.join(__dirname, "..", "bin", "en_US.aff");

    if (!enabled || !api.isViewableElement(element)) {
        return [];
    }

    spell = new SpellCheck(affix, dictionary);

    if (element.type === 'text') {
        return api.spellcheck(element.data, element.lineCol);
    } else if (element.attribs) {
        return api.lintAttribs(element.attribs);
    }

    return [];
};


api.lintAttribs = function (attribs) {
    var issues = [];

    Object.keys(attribs).forEach(function (attribName) {
        var attrib = attribs[attribName],
            newIssues;

        if (!api.isViewableAttrib(attribName)) {
            return;
        }

        newIssues = api.spellcheck(attrib.value, attrib.valueLineCol);
        issues = issues.concat(newIssues);
    }.bind(this));

    return issues;
};

api.spellcheck = function (text, pos) {
    return queue.add(function () {
        return api.spawnSpellcheck(text, pos);
    }.bind(api));
};

api.spawnSpellcheck = function (text, pos) {
    return new Promise(function (resolve, reject) {
        var words = text.match(/\w+/g);

        if(words) {
            async.reduce(words, [], function(issues, word, next) {
                spell.check(word, function(err, correct, suggestions) {
                    var message = "Misspelled word \""+word+"\".";

                    if(suggestions) {
                        message += " Suggestions: " + suggestions;
                    }

                    if(!correct) {
                        issues.push({
                            msg: message,
                            line: 0,
                            column: 0
                        });
                    }

                    next(err, issues);
                });
            }, function(error, issues) {
                if(error) {
                    reject(error);
                } else {
                    resolve(issues);
                }
            });
        } else {
            resolve([]);
        }
    });
};

api.isViewableElement = function (element) {
    var parent = element;

    while (parent) {
        if (parent.type === 'script' ||
            parent.type === 'style') {
            return false;
        }

        parent = parent.parent;
    }

    return true;
};

api.isViewableAttrib = function (attribName) {
    var lowercaseName = attribName.toLowerCase();

    return (viewableAttribs.indexOf(lowercaseName) > -1);
};

module.exports = api;
