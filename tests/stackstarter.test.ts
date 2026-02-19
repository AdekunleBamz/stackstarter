import {
    Account,
    Chain,
    Clarinet,
    Tx,
    types,
} from 'https://deno.land/x/clarinet@v1.4.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that campaign creation works",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;

        let block = chain.mineBlock([
            Tx.contractCall("stackstarter", "create-campaign", [
                types.buff("Test Campaign"),
                types.buff("Description"),
                types.buff("http://example.com"),
                types.uint(1000000),
                types.uint(100)
            ], deployer.address)
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectUint(1);
    },
});
