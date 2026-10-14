'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var core = require('@capacitor/core');

const SendIntent = core.registerPlugin("SendIntent", {
    web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.SendIntentWeb()),
});

class SendIntentWeb extends core.WebPlugin {
    constructor() {
        super();
    }
    async checkSendIntentReceived() {
        return { title: '' };
    }
    finish() {
    }
}

var web = /*#__PURE__*/Object.freeze({
    __proto__: null,
    SendIntentWeb: SendIntentWeb
});

exports.SendIntent = SendIntent;
//# sourceMappingURL=plugin.cjs.js.map
