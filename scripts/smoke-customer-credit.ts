// Smoke tests para los helpers de Pack D.1 (lib/customer-credit.ts).
// Ejecuta con: npx tsx scripts/smoke-customer-credit.ts
//
// Cubre:
//   T1 — rechargeCustomerCredit (happy path + shadow-write Customer.balance)
//   T2 — getCustomerCreditBalance (total + breakdown FIFO)
//   T3 — applyCustomerCredit (FIFO consume + shadow-write decrement)
//   T4 — mergeCustomerCredit (re-point + shadow-write sync)
//   T5 — failure-mid-helper rollback (G7 atomicity)
//
// Limpia data al final (test prefix con timestamp, deleteMany por id).

import { prisma } from "../src/lib/prisma";
import {
  applyCustomerCredit,
  getCustomerCreditBalance,
  mergeCustomerCredit,
  rechargeCustomerCredit,
} from "../src/lib/customer-credit";

const TEST_PREFIX = `smoke-d2-${Date.now()}`;

type Ctx = {
  customerA: { id: string };
  customerB: { id: string };
  session: { id: string };
  userId: string;
};

async function setup(): Promise<Ctx> {
  const session = await prisma.cashRegisterSession.findFirst({ where: { status: "OPEN" } });
  if (!session) throw new Error("setup: no hay CashRegisterSession OPEN — corre prisma db seed");

  const user = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!user) throw new Error("setup: no hay user ADMIN — corre prisma db seed");

  const customerA = await prisma.customer.create({ data: { name: `${TEST_PREFIX}-A` } });
  const customerB = await prisma.customer.create({ data: { name: `${TEST_PREFIX}-B` } });
  return { customerA, customerB, session, userId: user.id };
}

async function teardown(customerIds: string[]): Promise<void> {
  await prisma.creditConsumption.deleteMany({
    where: { customerCredit: { customerId: { in: customerIds } } },
  });
  await prisma.cashTransaction.deleteMany({
    where: { customerId: { in: customerIds } },
  });
  await prisma.customerCredit.deleteMany({ where: { customerId: { in: customerIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
}

async function main(): Promise<void> {
  const ctx = await setup();
  try {
    // T1 — rechargeCustomerCredit
    const c1 = await prisma.$transaction((tx) =>
      rechargeCustomerCredit(
        ctx.customerA.id,
        500,
        { tipo: "AJUSTE_MANAGER", notes: "smoke" },
        tx,
      ),
    );
    const a1 = await prisma.customer.findUniqueOrThrow({ where: { id: ctx.customerA.id } });
    if (Number(a1.balance) !== 500) throw new Error(`T1: Customer.balance=${a1.balance} expected 500`);
    if (Number(c1.balance) !== 500) throw new Error(`T1: credit.balance=${c1.balance} expected 500`);
    console.log("✅ T1 rechargeCustomerCredit: $500 + shadow-write");

    // T2 — getCustomerCreditBalance
    const b2 = await getCustomerCreditBalance(ctx.customerA.id);
    if (b2.total !== 500) throw new Error(`T2: total=${b2.total} expected 500`);
    if (b2.breakdown.length !== 1) throw new Error(`T2: breakdown=${b2.breakdown.length} expected 1`);
    if (b2.breakdown[0].origenTipo !== "AJUSTE_MANAGER") throw new Error(`T2: wrong origen`);
    console.log("✅ T2 getCustomerCreditBalance: total + breakdown FIFO");

    // T3 — applyCustomerCredit
    await prisma.$transaction(async (tx) => {
      const cashTx = await tx.cashTransaction.create({
        data: {
          sessionId: ctx.session.id,
          userId: ctx.userId,
          customerId: ctx.customerA.id,
          type: "PAYMENT_IN",
          method: "CREDIT_BALANCE",
          amount: 200,
        },
      });
      const r = await applyCustomerCredit(ctx.customerA.id, 200, cashTx.id, tx);
      if (r.consumed.length !== 1) throw new Error(`T3: consumed=${r.consumed.length} expected 1`);
      if (r.consumed[0].amount !== 200) throw new Error(`T3: amount=${r.consumed[0].amount}`);
    });
    const a3 = await prisma.customer.findUniqueOrThrow({ where: { id: ctx.customerA.id } });
    if (Number(a3.balance) !== 300) throw new Error(`T3: Customer.balance=${a3.balance} expected 300`);
    const cc3 = await prisma.customerCredit.findFirstOrThrow({ where: { customerId: ctx.customerA.id } });
    if (Number(cc3.balance) !== 300) throw new Error(`T3: credit.balance=${cc3.balance} expected 300`);
    const cons3 = await prisma.creditConsumption.findFirstOrThrow({ where: { customerCreditId: cc3.id } });
    if (Number(cons3.amount) !== 200) throw new Error(`T3: consumption.amount=${cons3.amount}`);
    console.log("✅ T3 applyCustomerCredit: FIFO consume $200 + shadow-write + CreditConsumption");

    // T4 — mergeCustomerCredit (B → A, B has $100, A has $300; expect A=$400, B=$0)
    await prisma.$transaction((tx) =>
      rechargeCustomerCredit(ctx.customerB.id, 100, { tipo: "DEVOLUCION" }, tx),
    );
    await prisma.$transaction((tx) =>
      mergeCustomerCredit(ctx.customerB.id, ctx.customerA.id, tx),
    );
    const a4 = await prisma.customer.findUniqueOrThrow({ where: { id: ctx.customerA.id } });
    const b4 = await prisma.customer.findUniqueOrThrow({ where: { id: ctx.customerB.id } });
    if (Number(a4.balance) !== 400) throw new Error(`T4: A.balance=${a4.balance} expected 400`);
    if (Number(b4.balance) !== 0) throw new Error(`T4: B.balance=${b4.balance} expected 0`);
    const aCredits = await prisma.customerCredit.count({ where: { customerId: ctx.customerA.id } });
    if (aCredits !== 2) throw new Error(`T4: A credits=${aCredits} expected 2`);
    const bCredits = await prisma.customerCredit.count({ where: { customerId: ctx.customerB.id } });
    if (bCredits !== 0) throw new Error(`T4: B credits=${bCredits} expected 0`);
    console.log("✅ T4 mergeCustomerCredit: re-point + shadow-write sync");

    // T5 — failure-mid-helper rollback (G7)
    const beforeBalance = Number(a4.balance);
    const beforeCreditsCount = await prisma.customerCredit.count({ where: { customerId: ctx.customerA.id } });
    const beforeCashTxCount = await prisma.cashTransaction.count({ where: { customerId: ctx.customerA.id } });
    let threw = false;
    try {
      await prisma.$transaction(async (tx) => {
        const cashTx = await tx.cashTransaction.create({
          data: {
            sessionId: ctx.session.id,
            userId: ctx.userId,
            customerId: ctx.customerA.id,
            type: "PAYMENT_IN",
            method: "CREDIT_BALANCE",
            amount: 50,
          },
        });
        await applyCustomerCredit(ctx.customerA.id, 50, cashTx.id, tx);
        throw new Error("SIMULATED_FAILURE_POST_HELPER");
      });
    } catch (e: unknown) {
      if (!(e instanceof Error) || e.message !== "SIMULATED_FAILURE_POST_HELPER") throw e;
      threw = true;
    }
    if (!threw) throw new Error("T5: expected SIMULATED_FAILURE but tx completed");

    const a5 = await prisma.customer.findUniqueOrThrow({ where: { id: ctx.customerA.id } });
    const a5Credits = await prisma.customerCredit.count({ where: { customerId: ctx.customerA.id } });
    const a5CashTx = await prisma.cashTransaction.count({ where: { customerId: ctx.customerA.id } });
    if (Number(a5.balance) !== beforeBalance) throw new Error(`T5: balance changed (${beforeBalance} → ${a5.balance})`);
    if (a5Credits !== beforeCreditsCount) throw new Error(`T5: credits count changed (${beforeCreditsCount} → ${a5Credits})`);
    if (a5CashTx !== beforeCashTxCount) throw new Error(`T5: cashTx count changed (${beforeCashTxCount} → ${a5CashTx})`);
    console.log("✅ T5 failure-mid-helper rollback (G7): Customer.balance + CustomerCredit + CashTransaction unchanged");

    console.log("\n🎉 All smoke tests passed (5/5)");
  } finally {
    await teardown([ctx.customerA.id, ctx.customerB.id]);
    console.log("🧹 Test data limpia");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Smoke failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
