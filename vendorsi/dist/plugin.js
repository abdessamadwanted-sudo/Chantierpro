var capacitorSendIntent = (function (exports, core) {
    'use strict';

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

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({}, capacitorExports);
//# sourceMappingURL=plugin.js.map
