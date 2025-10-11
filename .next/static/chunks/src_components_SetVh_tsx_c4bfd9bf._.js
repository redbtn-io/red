(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/SetVh.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SetVh
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
function SetVh() {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SetVh.useEffect": ()=>{
            const setVh = {
                "SetVh.useEffect.setVh": ()=>{
                    // 1% of the viewport height. Using this avoids issues with mobile browser chrome.
                    document.documentElement.style.setProperty('--vh', "".concat(window.innerHeight * 0.01, "px"));
                }
            }["SetVh.useEffect.setVh"];
            setVh();
            window.addEventListener('resize', setVh);
            window.addEventListener('orientationchange', setVh);
            return ({
                "SetVh.useEffect": ()=>{
                    window.removeEventListener('resize', setVh);
                    window.removeEventListener('orientationchange', setVh);
                }
            })["SetVh.useEffect"];
        }
    }["SetVh.useEffect"], []);
    return null;
}
_s(SetVh, "OD7bBpZva5O2jO+Puf00hKivP7c=");
_c = SetVh;
var _c;
__turbopack_context__.k.register(_c, "SetVh");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_components_SetVh_tsx_c4bfd9bf._.js.map