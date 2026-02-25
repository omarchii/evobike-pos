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
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var leoBranch, av135Branch, adminUser, demoCustomer, scooter, tire;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.branch.upsert({
                        where: { code: 'LEO' },
                        update: {},
                        create: {
                            code: 'LEO',
                            name: 'Sucursal Leo',
                            address: 'Cancún, Q.R. Leo',
                        },
                    })];
                case 1:
                    leoBranch = _a.sent();
                    return [4 /*yield*/, prisma.branch.upsert({
                            where: { code: 'AV135' },
                            update: {},
                            create: {
                                code: 'AV135',
                                name: 'Sucursal Av 135',
                                address: 'Cancún, Q.R. Av 135',
                            },
                        })
                        // 2. Create Admin User
                    ];
                case 2:
                    av135Branch = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'admin@evobike.mx' },
                            update: {},
                            create: {
                                name: 'Admin General',
                                email: 'admin@evobike.mx',
                                password: 'hased_pwd_placeholder', // TODO: Implement bcrypt hash
                                role: 'ADMIN',
                                branchId: leoBranch.id, // Admin can switch branches in UI
                            },
                        })
                        // 3. Create Demo Customer
                    ];
                case 3:
                    adminUser = _a.sent();
                    return [4 /*yield*/, prisma.customer.upsert({
                            where: { phone: '9981234567' },
                            update: {},
                            create: {
                                name: 'Cliente Mostrador',
                                phone: '9981234567',
                                email: 'cliente@evobike.mx',
                                creditLimit: 0,
                                balance: 0,
                            }
                        })
                        // 4. Create an Edge-Case Product (Serialized Scooter)
                    ];
                case 4:
                    demoCustomer = _a.sent();
                    return [4 /*yield*/, prisma.product.upsert({
                            where: { sku: 'SCOOTER-M365' },
                            update: {},
                            create: {
                                sku: 'SCOOTER-M365',
                                name: 'Xiaomi Scooter M365',
                                price: 8500.00,
                                cost: 6000.00,
                                isSerialized: true,
                                stocks: {
                                    create: [
                                        { branchId: leoBranch.id, quantity: 5 },
                                        { branchId: av135Branch.id, quantity: 2 }
                                    ]
                                }
                            }
                        })
                        // 5. Create a standard product (Refacción)
                    ];
                case 5:
                    scooter = _a.sent();
                    return [4 /*yield*/, prisma.product.upsert({
                            where: { sku: 'TIRE-8.5' },
                            update: {},
                            create: {
                                sku: 'TIRE-8.5',
                                name: 'Llanta 8.5 para Scooter',
                                price: 350.00,
                                cost: 120.00,
                                isSerialized: false,
                                stocks: {
                                    create: [
                                        { branchId: leoBranch.id, quantity: 20 },
                                        { branchId: av135Branch.id, quantity: 15 }
                                    ]
                                }
                            }
                        })];
                case 6:
                    tire = _a.sent();
                    console.log('Seed executed successfully!');
                    console.log({ leoBranch: leoBranch, av135Branch: av135Branch, adminUser: adminUser, scooter: scooter, tire: tire });
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); })
    .catch(function (e) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.error(e);
                return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                process.exit(1);
                return [2 /*return*/];
        }
    });
}); });
