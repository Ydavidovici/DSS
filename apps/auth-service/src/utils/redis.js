"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kv = exports.redis = void 0;
var redis_1 = require("redis");
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
exports.redis = (0, redis_1.createClient)({ url: process.env.REDIS_URL });
exports.redis.on("error", function (err) { return console.error("[redis] error:", err); });
exports.redis.on("connect", function () { return console.log("[redis] connected"); });
exports.redis.connect().catch(function (e) { return console.error("[redis] failed to connect:", e); });
function asJSON(raw) {
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch (_a) {
        return null;
    }
}
function getOrigin(u) {
    try {
        var url = new URL(u);
        return "".concat(url.protocol, "//").concat(url.host);
    }
    catch (_a) {
        return null;
    }
}
exports.kv = {
    // Generic JSON helpers
    getJSON: function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var v;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, exports.redis.get(key)];
                    case 1:
                        v = _a.sent();
                        return [2 /*return*/, asJSON(v)];
                }
            });
        });
    },
    setJSON: function (key, value, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function () {
            var payload;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        payload = JSON.stringify(value);
                        if (!(ttlSeconds && ttlSeconds > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, exports.redis.set(key, payload, { EX: ttlSeconds })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, exports.redis.set(key, payload)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    },
    // JWKS cache
    getJWKS: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getJSON("jwks")];
            });
        });
    },
    setJWKS: function (jwks_1) {
        return __awaiter(this, arguments, void 0, function (jwks, ttlSeconds) {
            if (ttlSeconds === void 0) { ttlSeconds = 3600; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.setJSON("jwks", jwks, ttlSeconds)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    // JWKS cache bust
    clearJWKS: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, exports.redis.del("jwks")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    // User sessions
    addUserSession: function (userId, jti) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, exports.redis.sAdd("uid:".concat(userId, ":sessions"), jti)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    removeUserSession: function (userId, jti) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, exports.redis.sRem("uid:".concat(userId, ":sessions"), jti)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    listUserSessions: function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, exports.redis.sMembers("uid:".concat(userId, ":sessions"))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    clearUserSessions: function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, exports.redis.del("uid:".concat(userId, ":sessions"))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    // Redirect allowlist (per-frontend)
    getAllowedRedirects: function () {
        return __awaiter(this, void 0, void 0, function () {
            var members, envList;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, exports.redis.sMembers("redirects:allow")];
                    case 1:
                        members = _a.sent();
                        if (members.length > 0)
                            return [2 /*return*/, members];
                        envList = (process.env.ALLOWED_REDIRECTS || "")
                            .split(",")
                            .map(function (s) { return s.trim(); })
                            .filter(Boolean);
                        if (!envList.length) return [3 /*break*/, 3];
                        return [4 /*yield*/, exports.redis.sAdd("redirects:allow", envList)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, envList];
                    case 3: return [2 /*return*/, []];
                }
            });
        });
    },
    addAllowedRedirect: function (baseOriginOrBaseURL) {
        return __awaiter(this, void 0, void 0, function () {
            var origin;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        origin = (_a = getOrigin(baseOriginOrBaseURL)) !== null && _a !== void 0 ? _a : baseOriginOrBaseURL;
                        return [4 /*yield*/, exports.redis.sAdd("redirects:allow", origin)];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    removeAllowedRedirect: function (baseOriginOrBaseURL) {
        return __awaiter(this, void 0, void 0, function () {
            var origin;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        origin = (_a = getOrigin(baseOriginOrBaseURL)) !== null && _a !== void 0 ? _a : baseOriginOrBaseURL;
                        return [4 /*yield*/, exports.redis.sRem("redirects:allow", origin)];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    isAllowedRedirect: function (target) {
        return __awaiter(this, void 0, void 0, function () {
            var allowed, origin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAllowedRedirects()];
                    case 1:
                        allowed = _a.sent();
                        if (allowed.length === 0)
                            return [2 /*return*/, false];
                        origin = getOrigin(target);
                        if (!origin)
                            return [2 /*return*/, false];
                        // Allowed if exact origin matches, or the full URL starts with an allowed origin + '/'
                        if (allowed.includes(origin))
                            return [2 /*return*/, true];
                        return [2 /*return*/, allowed.some(function (base) { return target.startsWith(base.endsWith("/") ? base : "".concat(base, "/")); })];
                }
            });
        });
    },
};
exports.default = exports.redis;
