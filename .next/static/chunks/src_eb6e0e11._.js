(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/conversation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Types for the chat application
 */ __turbopack_context__.s([
    "conversationStorage",
    ()=>conversationStorage
]);
/**
 * LocalStorage utilities for conversation management
 */ const CONVERSATIONS_KEY = 'red_conversations';
const ACTIVE_CONVERSATION_KEY = 'red_active_conversation';
const conversationStorage = {
    /**
   * Get all conversations
   */ getAll () {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        const stored = localStorage.getItem(CONVERSATIONS_KEY);
        return stored ? JSON.parse(stored) : [];
    },
    /**
   * Get a specific conversation by ID
   */ get (id) {
        const conversations = this.getAll();
        return conversations.find((c)=>c.id === id) || null;
    },
    /**
   * Save a conversation
   */ save (conversation) {
        const conversations = this.getAll();
        const index = conversations.findIndex((c)=>c.id === conversation.id);
        if (index >= 0) {
            conversations[index] = conversation;
        } else {
            conversations.push(conversation);
        }
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    },
    /**
   * Delete a conversation
   */ delete (id) {
        const conversations = this.getAll().filter((c)=>c.id !== id);
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    },
    /**
   * Get active conversation ID
   */ getActiveId () {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        return localStorage.getItem(ACTIVE_CONVERSATION_KEY);
    },
    /**
   * Set active conversation ID
   */ setActiveId (id) {
        localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
    },
    /**
   * Create a new conversation
   */ create () {
        const conversation = {
            id: "conv_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(7)),
            title: 'New Conversation',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.save(conversation);
        return conversation;
    },
    /**
   * Add a message to a conversation
   */ addMessage (conversationId, message) {
        const conversation = this.get(conversationId);
        if (!conversation) return;
        conversation.messages.push(message);
        conversation.updatedAt = Date.now();
        // Update title from first message if still "New Conversation"
        if (conversation.title === 'New Conversation' && message.role === 'user') {
            conversation.title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
        }
        this.save(conversation);
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/Modal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConfirmModal",
    ()=>ConfirmModal,
    "Modal",
    ()=>Modal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
;
;
function Modal(param) {
    let { isOpen, onClose, title, children } = param;
    if (!isOpen) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 bg-black bg-opacity-50 z-50",
                onClick: onClose
            }, void 0, false, {
                fileName: "[project]/src/components/Modal.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-50 flex items-center justify-center p-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl max-w-md w-full shadow-2xl",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between p-4 border-b border-[#2a2a2a]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-lg font-semibold text-gray-100",
                                    children: title
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Modal.tsx",
                                    lineNumber: 26,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: onClose,
                                    className: "p-1 hover:bg-[#2a2a2a] rounded-lg transition-colors text-gray-400 hover:text-gray-200",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                        size: 20
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/Modal.tsx",
                                        lineNumber: 31,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Modal.tsx",
                                    lineNumber: 27,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/Modal.tsx",
                            lineNumber: 25,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-4",
                            children: children
                        }, void 0, false, {
                            fileName: "[project]/src/components/Modal.tsx",
                            lineNumber: 36,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/Modal.tsx",
                    lineNumber: 23,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/Modal.tsx",
                lineNumber: 22,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_c = Modal;
function ConfirmModal(param) {
    let { isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger' } = param;
    const handleConfirm = ()=>{
        onConfirm();
        onClose();
    };
    const confirmButtonClass = variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : variant === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Modal, {
        isOpen: isOpen,
        onClose: onClose,
        title: title,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-gray-300 mb-6",
                children: message
            }, void 0, false, {
                fileName: "[project]/src/components/Modal.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-3 justify-end",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: onClose,
                        className: "px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] rounded-lg transition-colors text-gray-300",
                        children: cancelText
                    }, void 0, false, {
                        fileName: "[project]/src/components/Modal.tsx",
                        lineNumber: 82,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: handleConfirm,
                        className: "px-4 py-2 ".concat(confirmButtonClass, " rounded-lg transition-colors text-white font-medium"),
                        children: confirmText
                    }, void 0, false, {
                        fileName: "[project]/src/components/Modal.tsx",
                        lineNumber: 88,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Modal.tsx",
                lineNumber: 81,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/Modal.tsx",
        lineNumber: 78,
        columnNumber: 5
    }, this);
}
_c1 = ConfirmModal;
var _c, _c1;
__turbopack_context__.k.register(_c, "Modal");
__turbopack_context__.k.register(_c1, "ConfirmModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/Header.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Header",
    ()=>Header
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/menu.js [app-client] (ecmascript) <export default as Menu>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
;
;
function Header(param) {
    let { title, onMenuClick, onNewChat } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "sticky top-0 z-40 bg-[#0f0f0f] border-b border-[#2a2a2a] px-4 py-3 flex items-center gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: onMenuClick,
                className: "lg:hidden p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-300",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__["Menu"], {
                    size: 24
                }, void 0, false, {
                    fileName: "[project]/src/components/Header.tsx",
                    lineNumber: 16,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/Header.tsx",
                lineNumber: 12,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                className: "text-lg font-semibold text-gray-100",
                children: title
            }, void 0, false, {
                fileName: "[project]/src/components/Header.tsx",
                lineNumber: 18,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: onNewChat,
                className: "ml-auto p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-300",
                title: "New Chat",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                    size: 20
                }, void 0, false, {
                    fileName: "[project]/src/components/Header.tsx",
                    lineNumber: 26,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/Header.tsx",
                lineNumber: 21,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/Header.tsx",
        lineNumber: 11,
        columnNumber: 5
    }, this);
}
_c = Header;
var _c;
__turbopack_context__.k.register(_c, "Header");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/Sidebar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Sidebar",
    ()=>Sidebar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/message-square.js [app-client] (ecmascript) <export default as MessageSquare>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.js [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Edit2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pen.js [app-client] (ecmascript) <export default as Edit2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/terminal.js [app-client] (ecmascript) <export default as Terminal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
;
;
;
;
function Sidebar(param) {
    let { isOpen, conversations, activeConversationId, editingTitleId, editingTitleValue, onClose, onNewChat, onSwitchConversation, onDeleteClick, onStartEditingTitle, onSaveEditedTitle, onCancelEditingTitle, onEditingTitleChange } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "\n          fixed inset-y-0 left-0 z-50 w-64 bg-[#0f0f0f] border-r border-[#2a2a2a] text-white transform transition-transform duration-200 ease-in-out\n          lg:relative lg:translate-x-0\n          ".concat(isOpen ? 'translate-x-0' : '-translate-x-full', "\n        "),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col h-full",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-4 border-b border-[#2a2a2a]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/",
                                    className: "flex items-center gap-2 mb-4 no-underline hover:opacity-90",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                src: "/logo.png",
                                                alt: "Red",
                                                width: 32,
                                                height: 32,
                                                className: "w-full h-full object-cover"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/Sidebar.tsx",
                                                lineNumber: 52,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 51,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-lg font-semibold",
                                            children: "redbtn"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 60,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Sidebar.tsx",
                                    lineNumber: 50,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: onNewChat,
                                    className: "w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg transition-colors font-medium",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                            size: 18
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 66,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "New Chat"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 67,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Sidebar.tsx",
                                    lineNumber: 62,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/Sidebar.tsx",
                            lineNumber: 49,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1 overflow-y-auto p-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1",
                                children: conversations.map((conv)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "\n                    relative rounded-lg transition-all group\n                    ".concat(conv.id === activeConversationId ? 'bg-[#1a1a1a] border border-[#2a2a2a]' : 'hover:bg-[#1a1a1a] border border-transparent', "\n                  "),
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>onSwitchConversation(conv.id),
                                                className: "w-full text-left px-3 py-2.5",
                                                disabled: editingTitleId === conv.id,
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-start gap-2 pr-16",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"], {
                                                            size: 16,
                                                            className: "mt-0.5 flex-shrink-0 text-gray-400"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/Sidebar.tsx",
                                                            lineNumber: 91,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex-1 min-w-0",
                                                            children: [
                                                                editingTitleId === conv.id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-1",
                                                                    onClick: (e)=>e.stopPropagation(),
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                            type: "text",
                                                                            value: editingTitleValue,
                                                                            onChange: (e)=>onEditingTitleChange(e.target.value),
                                                                            onKeyDown: (e)=>{
                                                                                if (e.key === 'Enter') onSaveEditedTitle(conv.id);
                                                                                if (e.key === 'Escape') onCancelEditingTitle();
                                                                            },
                                                                            className: "flex-1 text-base font-medium bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-red-500",
                                                                            autoFocus: true
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/Sidebar.tsx",
                                                                            lineNumber: 95,
                                                                            columnNumber: 29
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            onClick: ()=>onSaveEditedTitle(conv.id),
                                                                            className: "p-1 hover:bg-[#2a2a2a] rounded text-green-400 hover:text-green-300",
                                                                            title: "Save",
                                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                                                size: 14
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/Sidebar.tsx",
                                                                                lineNumber: 111,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/Sidebar.tsx",
                                                                            lineNumber: 106,
                                                                            columnNumber: 29
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            onClick: onCancelEditingTitle,
                                                                            className: "p-1 hover:bg-[#2a2a2a] rounded text-gray-400 hover:text-gray-300",
                                                                            title: "Cancel",
                                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                                                size: 14
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/Sidebar.tsx",
                                                                                lineNumber: 118,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/Sidebar.tsx",
                                                                            lineNumber: 113,
                                                                            columnNumber: 29
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/components/Sidebar.tsx",
                                                                    lineNumber: 94,
                                                                    columnNumber: 27
                                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-sm font-medium truncate text-gray-200",
                                                                    children: conv.title
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/Sidebar.tsx",
                                                                    lineNumber: 122,
                                                                    columnNumber: 27
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-xs text-gray-500 mt-0.5",
                                                                    children: [
                                                                        conv.messages.length,
                                                                        " ",
                                                                        conv.messages.length === 1 ? 'message' : 'messages'
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/components/Sidebar.tsx",
                                                                    lineNumber: 124,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/Sidebar.tsx",
                                                            lineNumber: 92,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/Sidebar.tsx",
                                                    lineNumber: 90,
                                                    columnNumber: 21
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/Sidebar.tsx",
                                                lineNumber: 85,
                                                columnNumber: 19
                                            }, this),
                                            editingTitleId !== conv.id && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: (e)=>onStartEditingTitle(conv, e),
                                                        className: "p-2 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-blue-400",
                                                        title: "Edit title",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Edit2$3e$__["Edit2"], {
                                                            size: 14
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/Sidebar.tsx",
                                                            lineNumber: 139,
                                                            columnNumber: 25
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/Sidebar.tsx",
                                                        lineNumber: 134,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: (e)=>onDeleteClick(conv.id, e),
                                                        className: "p-2 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-red-400",
                                                        title: "Delete conversation",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                            size: 14
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/Sidebar.tsx",
                                                            lineNumber: 146,
                                                            columnNumber: 25
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/Sidebar.tsx",
                                                        lineNumber: 141,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/Sidebar.tsx",
                                                lineNumber: 133,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, conv.id, true, {
                                        fileName: "[project]/src/components/Sidebar.tsx",
                                        lineNumber: 75,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 73,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/Sidebar.tsx",
                            lineNumber: 72,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-4 border-t border-[#2a2a2a] space-y-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/logs",
                                    className: "flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors group",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"], {
                                            size: 16,
                                            className: "text-gray-400 group-hover:text-[var(--red-primary)]"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 162,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-sm text-gray-400 group-hover:text-[var(--foreground)]",
                                            children: "Virtual Terminal"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 163,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Sidebar.tsx",
                                    lineNumber: 158,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 text-xs text-gray-500 px-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-2 h-2 bg-green-500 rounded-full animate-pulse"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 170,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Red Connected"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 171,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Sidebar.tsx",
                                    lineNumber: 169,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/Sidebar.tsx",
                            lineNumber: 156,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/Sidebar.tsx",
                    lineNumber: 47,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/Sidebar.tsx",
                lineNumber: 40,
                columnNumber: 7
            }, this),
            isOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden",
                onClick: onClose
            }, void 0, false, {
                fileName: "[project]/src/components/Sidebar.tsx",
                lineNumber: 179,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true);
}
_c = Sidebar;
var _c;
__turbopack_context__.k.register(_c, "Sidebar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ChatInput.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ChatInput",
    ()=>ChatInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/send.js [app-client] (ecmascript) <export default as Send>");
;
;
function ChatInput(param) {
    let { value, disabled, messagesEndRef, onChange, onSend } = param;
    const handleKeyDown = (e)=>{
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "sticky bottom-0 z-40 bg-[#0f0f0f] border-t border-[#2a2a2a] py-3 px-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "max-w-4xl mx-auto flex gap-3 items-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 relative inline-block",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                            value: value,
                            onChange: (e)=>onChange(e.target.value),
                            onKeyDown: handleKeyDown,
                            onFocus: ()=>{
                                // On mobile, keyboard may resize viewport; scroll after a short delay
                                setTimeout(()=>{
                                    var _messagesEndRef_current;
                                    (_messagesEndRef_current = messagesEndRef.current) === null || _messagesEndRef_current === void 0 ? void 0 : _messagesEndRef_current.scrollIntoView({
                                        behavior: 'smooth'
                                    });
                                }, 300);
                            },
                            placeholder: "Type your message...",
                            className: "w-full resize-none bg-[#1a1a1a] border border-[#2a2a2a] text-gray-100 placeholder-gray-500 rounded-xl px-4 pr-16 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all leading-tight block",
                            rows: 1,
                            disabled: disabled
                        }, void 0, false, {
                            fileName: "[project]/src/components/ChatInput.tsx",
                            lineNumber: 23,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "hidden md:block pointer-events-none absolute right-3 bottom-3 text-xs text-gray-500 px-2 py-0.5 rounded-md ".concat(value ? 'opacity-0' : 'opacity-100', " transition-opacity bg-[#0f0f0f]"),
                            children: "(Shift+Enter for new line)"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ChatInput.tsx",
                            lineNumber: 39,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ChatInput.tsx",
                    lineNumber: 22,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: onSend,
                    disabled: !value.trim() || disabled,
                    className: "px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-lg",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__["Send"], {
                        size: 20
                    }, void 0, false, {
                        fileName: "[project]/src/components/ChatInput.tsx",
                        lineNumber: 48,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/ChatInput.tsx",
                    lineNumber: 43,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/ChatInput.tsx",
            lineNumber: 21,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ChatInput.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
_c = ChatInput;
var _c;
__turbopack_context__.k.register(_c, "ChatInput");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/Messages.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Messages",
    ()=>Messages
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/message-square.js [app-client] (ecmascript) <export default as MessageSquare>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$markdown$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__Markdown__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/react-markdown/lib/index.js [app-client] (ecmascript) <export Markdown as default>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$gfm$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/remark-gfm/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$math$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/remark-math/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$rehype$2d$katex$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/rehype-katex/lib/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
;
;
;
;
;
;
function Messages(param) {
    let { messages, thinking, currentStatus, isLoading, isStreaming, streamingMessageId, skeletonShrinking, messagesEndRef, conversationId } = param;
    _s();
    // State for showing thinking during skeleton/loading phase
    const [showLoadingThinking, setShowLoadingThinking] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Get thinking content for the streaming message (if any)
    const streamingThinking = streamingMessageId ? thinking[streamingMessageId] : null;
    const hasStreamingThinking = streamingThinking && streamingThinking.length > 0;
    // Debug logging to track what we're rendering
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Messages.useEffect": ()=>{
            console.log('┌────────────────────────────────────────────────────────┐');
            console.log('│ [MESSAGES COMPONENT RENDER]                            │');
            console.log('├────────────────────────────────────────────────────────┤');
            console.log('│ isLoading:', isLoading);
            console.log('│ currentStatus:', currentStatus);
            console.log('│ hasStreamingThinking:', hasStreamingThinking);
            console.log('│ streamingThinking length:', (streamingThinking === null || streamingThinking === void 0 ? void 0 : streamingThinking.length) || 0);
            console.log('└────────────────────────────────────────────────────────┘');
        }
    }["Messages.useEffect"], [
        isLoading,
        currentStatus,
        hasStreamingThinking,
        streamingThinking
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 overflow-y-auto pt-6 pb-6 px-6 space-y-6",
        children: [
            !(messages === null || messages === void 0 ? void 0 : messages.length) && !isLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-center h-full",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-center text-gray-500",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"], {
                            size: 48,
                            className: "mx-auto mb-4 opacity-20"
                        }, void 0, false, {
                            fileName: "[project]/src/components/Messages.tsx",
                            lineNumber: 57,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-lg font-medium",
                            children: "Start a conversation"
                        }, void 0, false, {
                            fileName: "[project]/src/components/Messages.tsx",
                            lineNumber: 58,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm mt-2",
                            children: "Send a message to begin chatting with Red AI"
                        }, void 0, false, {
                            fileName: "[project]/src/components/Messages.tsx",
                            lineNumber: 59,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/Messages.tsx",
                    lineNumber: 56,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/Messages.tsx",
                lineNumber: 55,
                columnNumber: 9
            }, this),
            messages === null || messages === void 0 ? void 0 : messages.map((message)=>{
                // Get thinking from prop for this message
                const thinkingContent = message.role === 'assistant' ? thinking[message.id] : null;
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MessageBubble, {
                    message: message,
                    thinking: thinkingContent || null,
                    isStreaming: isStreaming && streamingMessageId === message.id
                }, message.id, false, {
                    fileName: "[project]/src/components/Messages.tsx",
                    lineNumber: 68,
                    columnNumber: 11
                }, this);
            }),
            (()=>{
                console.log('🔵 isLoading check:', isLoading);
                return null;
            })(),
            isLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-start",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col gap-3 max-w-[80%]",
                    children: [
                        (()=>{
                            console.log('🔴 currentStatus check:', currentStatus);
                            return null;
                        })(),
                        currentStatus && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-gray-400",
                            style: {
                                borderColor: 'red',
                                borderWidth: '3px'
                            },
                            children: [
                                currentStatus.action === 'thinking' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Brain, {
                                    size: 16,
                                    className: "text-purple-400"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 90,
                                    columnNumber: 57
                                }, this),
                                currentStatus.action === 'processing' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(GitBranch, {
                                    size: 16,
                                    className: "text-blue-400"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 91,
                                    columnNumber: 59
                                }, this),
                                (currentStatus.action === 'searching' || currentStatus.action === 'web_search') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Search, {
                                    size: 16,
                                    className: "text-green-400"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 92,
                                    columnNumber: 101
                                }, this),
                                (currentStatus.action === 'system_command' || currentStatus.action === 'commands') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Terminal, {
                                    size: 16,
                                    className: "text-orange-400"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 93,
                                    columnNumber: 104
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "opacity-70",
                                    children: currentStatus.description || currentStatus.action
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 94,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/Messages.tsx",
                            lineNumber: 89,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-3.5 shadow-lg",
                            style: {
                                borderColor: 'blue',
                                borderWidth: '3px'
                            },
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-48 h-4 rounded skeleton ".concat(skeletonShrinking ? 'shrinking' : '')
                            }, void 0, false, {
                                fileName: "[project]/src/components/Messages.tsx",
                                lineNumber: 100,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/Messages.tsx",
                            lineNumber: 99,
                            columnNumber: 13
                        }, this),
                        (()=>{
                            console.log('🟢 hasStreamingThinking check:', hasStreamingThinking, 'length:', streamingThinking === null || streamingThinking === void 0 ? void 0 : streamingThinking.length);
                            return null;
                        })(),
                        hasStreamingThinking && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-[#1a1a1a] border border-purple-500/30 rounded-xl px-4 py-3 shadow-lg",
                            style: {
                                borderColor: 'lime',
                                borderWidth: '3px'
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>setShowLoadingThinking(!showLoadingThinking),
                                    className: "flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors w-full text-left",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Brain, {
                                            size: 16
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Messages.tsx",
                                            lineNumber: 114,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                showLoadingThinking ? 'Hide' : 'Show',
                                                " thinking"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/Messages.tsx",
                                            lineNumber: 115,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "ml-auto text-xs opacity-60",
                                            children: [
                                                streamingThinking.length,
                                                " chars"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/Messages.tsx",
                                            lineNumber: 116,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 110,
                                    columnNumber: 17
                                }, this),
                                showLoadingThinking && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-3 p-3 bg-black/20 rounded-lg text-sm",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "font-semibold mb-2 text-purple-300 flex items-center justify-between",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: "Reasoning:"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/Messages.tsx",
                                                    lineNumber: 124,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-xs opacity-60 animate-pulse",
                                                    children: "streaming..."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/Messages.tsx",
                                                    lineNumber: 125,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/Messages.tsx",
                                            lineNumber: 123,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "prose prose-invert prose-sm max-w-none  prose-p:my-1 prose-p:leading-relaxed prose-p:text-gray-300 prose-pre:bg-black/30 prose-pre:my-2 prose-code:text-white prose-code:bg-black/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs [&_.katex]:text-white [&_.katex]:text-sm",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$markdown$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__Markdown__as__default$3e$__["default"], {
                                                remarkPlugins: [
                                                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$gfm$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
                                                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$math$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
                                                ],
                                                rehypePlugins: [
                                                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$rehype$2d$katex$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
                                                ],
                                                children: streamingThinking
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/Messages.tsx",
                                                lineNumber: 132,
                                                columnNumber: 23
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Messages.tsx",
                                            lineNumber: 127,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 122,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/Messages.tsx",
                            lineNumber: 109,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/Messages.tsx",
                    lineNumber: 82,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/Messages.tsx",
                lineNumber: 81,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: messagesEndRef
            }, void 0, false, {
                fileName: "[project]/src/components/Messages.tsx",
                lineNumber: 146,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/Messages.tsx",
        lineNumber: 53,
        columnNumber: 5
    }, this);
}
_s(Messages, "s+LYa+iQPf3QntBubA4aJhk6Cww=");
_c = Messages;
function MessageBubble(param) {
    let { message, thinking, isStreaming } = param;
    _s1();
    // Thinking starts HIDDEN by default, user must click to show
    const [showThinking, setShowThinking] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const hasThinking = thinking && thinking.length > 0;
    // Show the toggle button if: thinking exists OR currently streaming
    const showToggle = hasThinking || isStreaming;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex ".concat(message.role === 'user' ? 'justify-end' : 'justify-start'),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "max-w-[80%] rounded-xl px-5 py-3.5 shadow-lg ".concat(message.role === 'user' ? 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-100' : "bg-red-500 text-white ".concat(isStreaming ? 'streaming-pulse' : '')),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "prose prose-invert max-w-none  prose-p:my-2 prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/20 prose-pre:my-3 prose-code:text-white prose-code:bg-black/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-a:text-white prose-a:underline  prose-strong:text-white prose-strong:font-semibold prose-em:text-white prose-em:italic prose-headings:text-white prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-table:my-3 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 [&_.katex]:text-white [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$markdown$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__Markdown__as__default$3e$__["default"], {
                        remarkPlugins: [
                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$gfm$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$math$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
                        ],
                        rehypePlugins: [
                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$rehype$2d$katex$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
                        ],
                        components: {
                            code: (param)=>{
                                let { node, inline, className, children, ...props } = param;
                                return inline ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                                    className: className,
                                    ...props,
                                    children: children
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 195,
                                    columnNumber: 19
                                }, void 0) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                                    className: "overflow-x-auto",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                                        className: className,
                                        ...props,
                                        children: children
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/Messages.tsx",
                                        lineNumber: 200,
                                        columnNumber: 21
                                    }, void 0)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 199,
                                    columnNumber: 19
                                }, void 0);
                            },
                            p: (param)=>{
                                let { children, ...props } = param;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    ...props,
                                    children: children
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 206,
                                    columnNumber: 44
                                }, void 0);
                            }
                        },
                        children: message.content
                    }, void 0, false, {
                        fileName: "[project]/src/components/Messages.tsx",
                        lineNumber: 189,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/Messages.tsx",
                    lineNumber: 178,
                    columnNumber: 9
                }, this),
                showToggle && message.role === 'assistant' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-3 pt-3 border-t border-white/20",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>setShowThinking(!showThinking),
                            className: "flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition-opacity w-full text-left",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Brain, {
                                    size: 16
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 220,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: [
                                        showThinking ? 'Hide' : 'Show',
                                        " thinking"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 221,
                                    columnNumber: 15
                                }, this),
                                isStreaming && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "ml-auto text-xs opacity-60 animate-pulse",
                                    children: hasThinking ? 'streaming...' : 'waiting...'
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 223,
                                    columnNumber: 17
                                }, this),
                                !isStreaming && hasThinking && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "ml-auto text-xs opacity-40",
                                    children: [
                                        (thinking === null || thinking === void 0 ? void 0 : thinking.length) || 0,
                                        " chars"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 228,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/Messages.tsx",
                            lineNumber: 216,
                            columnNumber: 13
                        }, this),
                        showThinking && hasThinking && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-3 p-3 bg-black/20 rounded-lg text-sm",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "font-semibold mb-2 opacity-70 flex items-center justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Reasoning:"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Messages.tsx",
                                            lineNumber: 237,
                                            columnNumber: 19
                                        }, this),
                                        isStreaming && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-xs opacity-60 animate-pulse",
                                            children: "updating live..."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Messages.tsx",
                                            lineNumber: 239,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 236,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "prose prose-invert prose-sm max-w-none opacity-90  prose-p:my-1 prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:my-2 prose-code:text-white prose-code:bg-black/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs [&_.katex]:text-white [&_.katex]:text-sm",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$markdown$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__Markdown__as__default$3e$__["default"], {
                                        remarkPlugins: [
                                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$gfm$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"],
                                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$remark$2d$math$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
                                        ],
                                        rehypePlugins: [
                                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$rehype$2d$katex$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
                                        ],
                                        children: thinking
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/Messages.tsx",
                                        lineNumber: 247,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Messages.tsx",
                                    lineNumber: 242,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/Messages.tsx",
                            lineNumber: 235,
                            columnNumber: 15
                        }, this),
                        showThinking && !hasThinking && isStreaming && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-3 p-3 bg-black/20 rounded-lg text-sm",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs opacity-60 italic",
                                children: "Waiting for thinking to start..."
                            }, void 0, false, {
                                fileName: "[project]/src/components/Messages.tsx",
                                lineNumber: 259,
                                columnNumber: 17
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/Messages.tsx",
                            lineNumber: 258,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/Messages.tsx",
                    lineNumber: 215,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/Messages.tsx",
            lineNumber: 170,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/Messages.tsx",
        lineNumber: 167,
        columnNumber: 5
    }, this);
}
_s1(MessageBubble, "wc5OGq6H3Bcs3gJhvOWgZbMuAPM=");
_c1 = MessageBubble;
var _c, _c1;
__turbopack_context__.k.register(_c, "Messages");
__turbopack_context__.k.register(_c1, "MessageBubble");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ChatPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/conversation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Modal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Modal.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Header.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Sidebar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Sidebar.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ChatInput$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ChatInput.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Messages$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Messages.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
function ChatPage() {
    _s();
    const [conversations, setConversations] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activeConversationId, setActiveConversationId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [input, setInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [skeletonShrinking, setSkeletonShrinking] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isStreaming, setIsStreaming] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [streamingMessageId, setStreamingMessageId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [currentThinking, setCurrentThinking] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [currentStatus, setCurrentStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isSidebarOpen, setIsSidebarOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [deleteModalOpen, setDeleteModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [conversationToDelete, setConversationToDelete] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [editingTitleId, setEditingTitleId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [editingTitleValue, setEditingTitleValue] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const messagesEndRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const activeConversation = conversations.find((c)=>c.id === activeConversationId);
    // Debug: Track status changes
    // Debug state changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ChatPage.useEffect": ()=>{
            console.log('════════════════════════════════════════════════════════');
            console.log('[STATE] isLoading:', isLoading);
            console.log('[STATE] isStreaming:', isStreaming);
            console.log('[STATE] streamingMessageId:', streamingMessageId);
            console.log('[STATE] currentStatus:', currentStatus);
            console.log('[STATE] currentThinking keys:', Object.keys(currentThinking));
            console.log('[STATE] skeletonShrinking:', skeletonShrinking);
            console.log('════════════════════════════════════════════════════════');
        }
    }["ChatPage.useEffect"], [
        isLoading,
        isStreaming,
        streamingMessageId,
        currentStatus,
        currentThinking,
        skeletonShrinking
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ChatPage.useEffect": ()=>{
            console.log('[DEBUG] currentStatus changed:', currentStatus);
        }
    }["ChatPage.useEffect"], [
        currentStatus
    ]);
    // Load conversations on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ChatPage.useEffect": ()=>{
            const stored = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].getAll();
            setConversations(stored);
            const activeId = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].getActiveId();
            if (activeId && stored.some({
                "ChatPage.useEffect": (c)=>c.id === activeId
            }["ChatPage.useEffect"])) {
                setActiveConversationId(activeId);
            } else if (stored.length > 0) {
                setActiveConversationId(stored[0].id);
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].setActiveId(stored[0].id);
            }
        }
    }["ChatPage.useEffect"], []);
    // Auto-scroll to bottom of messages
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ChatPage.useEffect": ()=>{
            var _messagesEndRef_current;
            (_messagesEndRef_current = messagesEndRef.current) === null || _messagesEndRef_current === void 0 ? void 0 : _messagesEndRef_current.scrollIntoView({
                behavior: 'smooth'
            });
        }
    }["ChatPage.useEffect"], [
        activeConversation === null || activeConversation === void 0 ? void 0 : activeConversation.messages
    ]);
    const createNewConversation = ()=>{
        const newConv = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].create();
        setConversations((prev)=>[
                newConv,
                ...prev
            ]);
        setActiveConversationId(newConv.id);
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].setActiveId(newConv.id);
        setIsSidebarOpen(false);
    };
    const switchConversation = (id)=>{
        setActiveConversationId(id);
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].setActiveId(id);
        setIsSidebarOpen(false);
        // Clear state when switching conversations
        setCurrentThinking({});
        setCurrentStatus(null);
    };
    const handleDeleteClick = (id, event)=>{
        event.stopPropagation(); // Prevent switching to the conversation
        setConversationToDelete(id);
        setDeleteModalOpen(true);
    };
    const handleDeleteConfirm = ()=>{
        if (!conversationToDelete) return;
        // Delete the conversation
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].delete(conversationToDelete);
        const updatedConversations = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].getAll();
        setConversations(updatedConversations);
        // If we deleted the active conversation, switch to another one
        if (conversationToDelete === activeConversationId) {
            if (updatedConversations.length > 0) {
                setActiveConversationId(updatedConversations[0].id);
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].setActiveId(updatedConversations[0].id);
            } else {
                setActiveConversationId(null);
            }
        }
        setConversationToDelete(null);
    };
    // Fetch conversation title from Redis (generated by Red AI)
    const fetchConversationTitle = async (conversationId)=>{
        try {
            const response = await fetch("/api/v1/conversations/".concat(conversationId, "/title"));
            if (response.ok) {
                const data = await response.json();
                if (data.title) {
                    const conv = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].get(conversationId);
                    if (conv && !conv.titleSetByUser) {
                        // Only update if user hasn't set a custom title
                        conv.title = data.title;
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].save(conv);
                        setConversations(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].getAll());
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching conversation title:', error);
        }
    };
    // Update conversation title (user override)
    const updateConversationTitle = async (conversationId, newTitle)=>{
        try {
            const response = await fetch("/api/v1/conversations/".concat(conversationId, "/title"), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: newTitle
                })
            });
            if (response.ok) {
                const conv = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].get(conversationId);
                if (conv) {
                    conv.title = newTitle;
                    conv.titleSetByUser = true;
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].save(conv);
                    setConversations(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].getAll());
                }
            }
        } catch (error) {
            console.error('Error updating conversation title:', error);
        }
    };
    const startEditingTitle = (conv, event)=>{
        event.stopPropagation();
        setEditingTitleId(conv.id);
        setEditingTitleValue(conv.title);
    };
    const saveEditedTitle = async (conversationId)=>{
        if (editingTitleValue.trim()) {
            await updateConversationTitle(conversationId, editingTitleValue.trim());
        }
        setEditingTitleId(null);
        setEditingTitleValue('');
    };
    const cancelEditingTitle = ()=>{
        setEditingTitleId(null);
        setEditingTitleValue('');
    };
    // Separate function to connect to message stream (can be called for reconnection)
    const streamMessage = async (convId, messageId, streamUrl)=>{
        const assistantMessage = {
            id: messageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now()
        };
        let messageAdded = false;
        let canStartDisplaying = false;
        let firstCharReceived = false;
        let streamingStarted = false; // NEW: Track if we've started streaming state
        let receivedThinkingChunks = false; // Track if we received any thinking
        const displayQueue = [];
        let isDisplaying = false;
        let displayedContent = '';
        const startSkeletonShrink = ()=>{
            if (streamingStarted) return; // Only do this once
            streamingStarted = true;
            setSkeletonShrinking(true);
            setIsStreaming(true);
            setStreamingMessageId(messageId);
            setTimeout(()=>{
                setIsLoading(false);
                setSkeletonShrinking(false);
                canStartDisplaying = true;
            }, 400);
        };
        const displayNextChar = async ()=>{
            if (isDisplaying) return;
            if (!canStartDisplaying) {
                setTimeout(()=>displayNextChar(), 50);
                return;
            }
            isDisplaying = true;
            while(displayQueue.length > 0){
                const char = displayQueue.shift();
                if (char) {
                    displayedContent += char;
                    assistantMessage.content = displayedContent;
                    if (!messageAdded && displayedContent.trim()) {
                        const conv = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].get(convId);
                        if (conv) {
                            conv.messages.push(assistantMessage);
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].save(conv);
                            setConversations(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].getAll());
                            messageAdded = true;
                            setTimeout(()=>{
                                var _messagesEndRef_current;
                                (_messagesEndRef_current = messagesEndRef.current) === null || _messagesEndRef_current === void 0 ? void 0 : _messagesEndRef_current.scrollIntoView({
                                    behavior: 'smooth'
                                });
                            }, 50);
                        }
                    } else if (messageAdded) {
                        const conv = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].get(convId);
                        if (conv) {
                            const msgIndex = conv.messages.findIndex((m)=>m.id === messageId);
                            if (msgIndex >= 0) {
                                conv.messages[msgIndex] = {
                                    ...assistantMessage
                                };
                                conv.updatedAt = Date.now();
                                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].save(conv);
                                setConversations(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].getAll());
                            }
                        }
                    }
                    await new Promise((resolve)=>setTimeout(resolve, 10));
                }
            }
            isDisplaying = false;
        };
        try {
            var _eventSource_body;
            const eventSource = await fetch(streamUrl, {
                // Disable timeout on the fetch itself - let SSE stay open
                signal: AbortSignal.timeout(300000) // 5 minute max timeout
            });
            if (!eventSource.ok) {
                const errorText = await eventSource.text();
                console.error('[Stream] Error response:', errorText);
                // If it's a 504 timeout, show a more helpful message
                if (eventSource.status === 504) {
                    throw new Error('Request is taking longer than expected. The AI is still processing - please wait or try a simpler question.');
                }
                throw new Error("Failed to connect to stream: ".concat(eventSource.status, " ").concat(errorText.substring(0, 200)));
            }
            const reader = (_eventSource_body = eventSource.body) === null || _eventSource_body === void 0 ? void 0 : _eventSource_body.getReader();
            const decoder = new TextDecoder();
            if (reader) {
                while(true){
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    for (const line of lines){
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            try {
                                const event = JSON.parse(data);
                                // Only log non-content/non-thinking events to avoid spam
                                if (event.type !== 'content' && event.type !== 'thinking_chunk') {
                                    console.log('[PAGE] Event received:', event.type, event);
                                }
                                // Handle different event types
                                if (event.type === 'status') {
                                    console.log('[EVENT] ⚡ Status received:', event.action);
                                    setCurrentStatus({
                                        action: event.action,
                                        description: event.description
                                    });
                                    continue;
                                }
                                if (event.type === 'thinking_chunk' && event.content) {
                                    if (!receivedThinkingChunks) {
                                        console.log('[EVENT] 🧠 First thinking chunk received - starting accumulation');
                                        receivedThinkingChunks = true;
                                    }
                                    setCurrentThinking((prev)=>({
                                            ...prev,
                                            [messageId]: (prev[messageId] || '') + event.content
                                        }));
                                    continue;
                                }
                                if (event.type === 'content' && event.content) {
                                    if (!firstCharReceived) {
                                        console.log('[EVENT] 📝 First content chunk received - starting skeleton shrink');
                                        firstCharReceived = true;
                                        startSkeletonShrink();
                                    }
                                    const characters = event.content.split('');
                                    displayQueue.push(...characters);
                                    if (!isDisplaying) {
                                        displayNextChar();
                                    }
                                    continue;
                                }
                                if (event.type === 'thinking' && event.content) {
                                    // Legacy: Store full thinking block
                                    setCurrentThinking((prev)=>({
                                            ...prev,
                                            [messageId]: (prev[messageId] || '') + event.content
                                        }));
                                    // Ensure streaming state is set when thinking arrives
                                    if (!streamingStarted) {
                                        startSkeletonShrink();
                                    }
                                    continue;
                                }
                                if (event.type === 'complete') {
                                    // Generation complete
                                    console.log('[EVENT] ✅ Complete received - stream ending');
                                    break; // Exit the stream reader loop
                                }
                                if (event.type === 'error') {
                                    throw new Error(event.error);
                                }
                                console.log('[DEBUG] Unhandled event type:', event.type, event);
                            } catch (e) {
                                if (e instanceof SyntaxError) continue; // Ignore JSON parse errors
                                throw e;
                            }
                        }
                    }
                }
                // Wait for display queue to finish
                while(displayQueue.length > 0 || isDisplaying){
                    await new Promise((resolve)=>setTimeout(resolve, 50));
                }
                if (displayedContent.trim() && !messageAdded) {
                    const conv = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].get(convId);
                    if (conv) {
                        conv.messages.push(assistantMessage);
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].save(conv);
                    }
                }
            } // Close if (reader) block
        } catch (error) {
            throw error;
        } finally{
            setIsLoading(false);
            setSkeletonShrinking(false);
            setIsStreaming(false);
            setStreamingMessageId(null);
            setCurrentStatus(null);
        }
    };
    const sendMessage = async ()=>{
        if (!input.trim() || isLoading) return;
        let convId = activeConversationId;
        // Create new conversation if none exists
        if (!convId) {
            const newConv = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].create();
            setConversations((prev)=>[
                    newConv,
                    ...prev
                ]);
            convId = newConv.id;
            setActiveConversationId(convId);
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].setActiveId(convId);
        }
        const userMessage = {
            id: "msg_".concat(Date.now(), "_user"),
            role: 'user',
            content: input.trim(),
            timestamp: Date.now()
        };
        // Add user message
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].addMessage(convId, userMessage);
        setConversations(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].getAll());
        setInput('');
        setIsLoading(true);
        // Clear any old state from previous messages
        setCurrentThinking({});
        setCurrentStatus(null);
        try {
            // Step 1: Trigger generation (returns immediately with messageId)
            const response = await fetch('/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'Red',
                    messages: [
                        {
                            role: 'user',
                            content: userMessage.content
                        }
                    ],
                    stream: true,
                    conversationId: convId
                })
            });
            if (!response.ok) {
                throw new Error('Failed to start generation');
            }
            const data = await response.json();
            const messageId = data.id;
            const streamUrl = data.stream_url;
            // Step 2: Connect to message stream
            await streamMessage(convId, messageId, streamUrl);
            // Fetch title after message completes
            const conv = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conversation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["conversationStorage"].get(convId);
            const messageCount = (conv === null || conv === void 0 ? void 0 : conv.messages.length) || 0;
            if (messageCount === 2 || messageCount === 6) {
                setTimeout(()=>fetchConversationTitle(convId), 1500);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            console.error('Error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                error
            });
            alert("Failed to send message: ".concat(error instanceof Error ? error.message : String(error)));
            setIsLoading(false);
            setSkeletonShrinking(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex bg-[#0a0a0a]",
        style: {
            height: 'calc(var(--vh, 1vh) * 100)'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Sidebar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Sidebar"], {
                isOpen: isSidebarOpen,
                conversations: conversations,
                activeConversationId: activeConversationId,
                editingTitleId: editingTitleId,
                editingTitleValue: editingTitleValue,
                onClose: ()=>setIsSidebarOpen(false),
                onNewChat: createNewConversation,
                onSwitchConversation: switchConversation,
                onDeleteClick: handleDeleteClick,
                onStartEditingTitle: startEditingTitle,
                onSaveEditedTitle: saveEditedTitle,
                onCancelEditingTitle: cancelEditingTitle,
                onEditingTitleChange: setEditingTitleValue
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 467,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 flex flex-col",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Header"], {
                        title: (activeConversation === null || activeConversation === void 0 ? void 0 : activeConversation.title) || 'Chat',
                        onMenuClick: ()=>setIsSidebarOpen(!isSidebarOpen),
                        onNewChat: createNewConversation
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 486,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Messages$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Messages"], {
                        messages: activeConversation === null || activeConversation === void 0 ? void 0 : activeConversation.messages,
                        thinking: currentThinking,
                        currentStatus: currentStatus,
                        isLoading: isLoading,
                        isStreaming: isStreaming,
                        streamingMessageId: streamingMessageId,
                        skeletonShrinking: skeletonShrinking,
                        messagesEndRef: messagesEndRef,
                        conversationId: activeConversation === null || activeConversation === void 0 ? void 0 : activeConversation.id
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 493,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ChatInput$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ChatInput"], {
                        value: input,
                        disabled: isLoading,
                        messagesEndRef: messagesEndRef,
                        onChange: setInput,
                        onSend: sendMessage
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 506,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 484,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Modal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConfirmModal"], {
                isOpen: deleteModalOpen,
                onClose: ()=>setDeleteModalOpen(false),
                onConfirm: handleDeleteConfirm,
                title: "Delete Conversation",
                message: "Are you sure you want to delete this conversation? This action cannot be undone.",
                confirmText: "Delete",
                cancelText: "Cancel",
                variant: "danger"
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 516,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 465,
        columnNumber: 5
    }, this);
}
_s(ChatPage, "l5U5j+pWe0uiOIxNwnC/no/7xmY=");
_c = ChatPage;
var _c;
__turbopack_context__.k.register(_c, "ChatPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_eb6e0e11._.js.map