"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendDebugStep = appendDebugStep;
/** 各步骤写入可折叠的 debug 信息，仅在 includeDebug 为 true 时生效 */
function appendDebugStep(state, step) {
    if (!state.includeDebug)
        return;
    state.debugTrace.push(step);
}
