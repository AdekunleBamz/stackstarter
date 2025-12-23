const {assert} = require("chai");

const {readFileSync} = require('fs');

const
	{
	cvToString,
	getCVTypeString,
	ClarityType
	} = require('@blockstack/stacks-transactions');

const BN = require('bn.js');

const StackstarterClient = require('../src/stackstarterclient');
const StacksMocknet = require('../src/stacksmocknet');

const accounts = require('./accounts.json');

const contract_name = 'stackstarter';

describe('stackstarter extended tests',async () =>
	{
	let contract_owner = accounts[0];
	let user_a = accounts[1];
	let user_b = accounts[2];
	let user_c = accounts[3];
	let mocknet;
	let stacks_node_api;
	let client_a;
	let client_b;
	let client_c;
	let test_campaign_id;

	before(async () =>
		{
		mocknet = new StacksMocknet();
		stacks_node_api = mocknet.api;
		client_a = new StackstarterClient(contract_owner.stacksAddress,user_a,stacks_node_api);
		client_b = new StackstarterClient(contract_owner.stacksAddress,user_b,stacks_node_api);
		client_c = new StackstarterClient(contract_owner.stacksAddress,user_c,stacks_node_api);
		await mocknet.deploy_contract('./contracts/stackstarter.clar',contract_name,contract_owner);
		});

	describe('Campaign Creation Edge Cases', () => {
		it('handles campaigns with very short durations', async () => {
			const new_campaign = {
				name: 'quick campaign',
				description: 'very short duration campaign',
				link: 'https://quick.local',
				goal: new BN('1000000'),
				duration: new BN('1') // Very short duration
			};

			await client_a.create_campaign(new_campaign);
			await mocknet.wait_n_blocks(1);
			const campaign_id = await client_a.get_total_campaigns();
			const campaign = await client_a.get_campaign(campaign_id);

			assert.notEqual(getCVTypeString(campaign), '(responseOk (optional none))', 'campaign should exist');
			const data = campaign.value.value.data;
			assert.equal(cvToString(data.duration), 'u1', 'duration should be 1 block');
		});

		it('handles campaigns with very long durations', async () => {
			const new_campaign = {
				name: 'long campaign',
				description: 'very long duration campaign',
				link: 'https://long.local',
				goal: new BN('5000000'),
				duration: new BN('1000000') // Very long duration
			};

			await client_a.create_campaign(new_campaign);
			await mocknet.wait_n_blocks(1);
			const campaign_id = await client_a.get_total_campaigns();
			const campaign = await client_a.get_campaign(campaign_id);

			assert.notEqual(getCVTypeString(campaign), '(responseOk (optional none))', 'campaign should exist');
			const data = campaign.value.value.data;
			assert.equal(cvToString(data.duration), 'u1000000', 'duration should be 1,000,000 blocks');
		});

		it('handles campaigns with very small goals', async () => {
			const new_campaign = {
				name: 'small goal campaign',
				description: 'campaign with tiny funding goal',
				link: 'https://small.local',
				goal: new BN('1'), // Very small goal
				duration: new BN('1000')
			};

			await client_a.create_campaign(new_campaign);
			await mocknet.wait_n_blocks(1);
			const campaign_id = await client_a.get_total_campaigns();
			const campaign = await client_a.get_campaign(campaign_id);

			assert.notEqual(getCVTypeString(campaign), '(responseOk (optional none))', 'campaign should exist');
			const data = campaign.value.value.data;
			assert.equal(cvToString(data.goal), 'u1', 'goal should be 1 microSTX');
		});

		it('handles campaigns with very large goals', async () => {
			const large_goal = new BN('1000000000000'); // 1 trillion microSTX
			const new_campaign = {
				name: 'large goal campaign',
				description: 'campaign with massive funding goal',
				link: 'https://large.local',
				goal: large_goal,
				duration: new BN('50000')
			};

			await client_a.create_campaign(new_campaign);
			await mocknet.wait_n_blocks(1);
			const campaign_id = await client_a.get_total_campaigns();
			const campaign = await client_a.get_campaign(campaign_id);

			assert.notEqual(getCVTypeString(campaign), '(responseOk (optional none))', 'campaign should exist');
			const data = campaign.value.value.data;
			assert.equal(cvToString(data.goal), 'u1000000000000', 'goal should be 1 trillion microSTX');
		});
	});

	describe('Tier Management Extended', () => {
		before(async () => {
			const new_campaign = {
				name: 'multi-tier campaign',
				description: 'campaign with multiple tiers for testing',
				link: 'https://multi-tier.local',
				goal: new BN('5000000'),
				duration: new BN('10000')
			};
			await client_a.create_campaign(new_campaign);
			await mocknet.wait_n_blocks(1);
			test_campaign_id = await client_a.get_total_campaigns();
		});

		it('handles multiple tiers per campaign', async () => {
			const tiers = [
				{ name: 'Bronze', description: 'Basic support', cost: 100000 },
				{ name: 'Silver', description: 'Enhanced support', cost: 250000 },
				{ name: 'Gold', description: 'Premium support', cost: 500000 },
				{ name: 'Platinum', description: 'Ultimate support', cost: 1000000 }
			];

			for (const tier of tiers) {
				await client_a.add_tier({
					campaign_id: test_campaign_id,
					name: tier.name,
					description: tier.description,
					cost: tier.cost
				});
			}

			await mocknet.wait_n_blocks(1);
			const total_tiers = await client_a.get_total_campaign_tiers(test_campaign_id);
			assert.equal(total_tiers.toString(), '4', 'should have 4 tiers');

			// Verify each tier exists and has correct data
			for (let i = 1; i <= tiers.length; i++) {
				const tier = await client_a.get_campaign_tier(test_campaign_id, new BN(i));
				assert.notEqual(getCVTypeString(tier), '(responseOk (optional none))', `tier ${i} should exist`);

				const data = tier.value.value.data;
				assert.equal(cvToString(data.name), `"${tiers[i-1].name}"`, `tier ${i} name should match`);
				assert.equal(cvToString(data.cost), `u${tiers[i-1].cost}`, `tier ${i} cost should match`);
			}
		});

		it('handles tier cost edge cases', async () => {
			// Add tier with very small cost
			await client_a.add_tier({
				campaign_id: test_campaign_id,
				name: 'Micro',
				description: 'Very small contribution',
				cost: 1 // Minimum possible
			});

			// Add tier with very large cost
			await client_a.add_tier({
				campaign_id: test_campaign_id,
				name: 'Mega',
				description: 'Very large contribution',
				cost: 100000000 // 100 STX
			});

			await mocknet.wait_n_blocks(1);
			const total_tiers = await client_a.get_total_campaign_tiers(test_campaign_id);
			assert.equal(total_tiers.toString(), '6', 'should now have 6 tiers');

			// Verify edge case tiers
			const micro_tier = await client_a.get_campaign_tier(test_campaign_id, new BN('5'));
			const mega_tier = await client_a.get_campaign_tier(test_campaign_id, new BN('6'));

			assert.notEqual(getCVTypeString(micro_tier), '(responseOk (optional none))', 'micro tier should exist');
			assert.notEqual(getCVTypeString(mega_tier), '(responseOk (optional none))', 'mega tier should exist');

			const micro_data = micro_tier.value.value.data;
			const mega_data = mega_tier.value.value.data;

			assert.equal(cvToString(micro_data.cost), 'u1', 'micro tier cost should be 1');
			assert.equal(cvToString(mega_data.cost), 'u100000000', 'mega tier cost should be 100,000,000');
		});
	});

	describe('Investment Scenarios Extended', () => {
		let investment_campaign_id;
		let tier1_id, tier2_id, tier3_id;

		before(async () => {
			const new_campaign = {
				name: 'investment test campaign',
				description: 'campaign for testing various investment scenarios',
				link: 'https://investment-test.local',
				goal: new BN('2000000'),
				duration: new BN('5000')
			};
			await client_a.create_campaign(new_campaign);
			await mocknet.wait_n_blocks(1);
			investment_campaign_id = await client_a.get_total_campaigns();

			// Add multiple tiers
			await client_a.add_tier({
				campaign_id: investment_campaign_id,
				name: 'Tier 1',
				description: 'Basic tier',
				cost: 500000
			});
			await client_a.add_tier({
				campaign_id: investment_campaign_id,
				name: 'Tier 2',
				description: 'Medium tier',
				cost: 1000000
			});
			await client_a.add_tier({
				campaign_id: investment_campaign_id,
				name: 'Tier 3',
				description: 'Premium tier',
				cost: 1500000
			});

			await mocknet.wait_n_blocks(1);
			tier1_id = new BN('1');
			tier2_id = new BN('2');
			tier3_id = new BN('3');
		});

		it('handles multiple investments in same tier', async () => {
			// Both users invest in tier 1
			const invest_amount = new BN('600000'); // Above minimum 500000

			await client_b.invest(investment_campaign_id, tier1_id, invest_amount);
			await client_c.invest(investment_campaign_id, tier1_id, invest_amount);
			await mocknet.wait_n_blocks(1);

			const totals = await client_a.get_campaign_tier_totals(investment_campaign_id, tier1_id);
			assert.notEqual(getCVTypeString(totals), '(responseOk (optional none))', 'tier totals should exist');

			const data = totals.value.value.data;
			assert.isTrue(data['total-investment'].value.eq(new BN('1200000')), 'total investment should be 1,200,000');
			assert.isTrue(data['total-investors'].value.eq(new BN('2')), 'total investors should be 2');

			// Check individual investments
			const investment_b = await client_b.get_campaign_tier_investment_amount(investment_campaign_id, tier1_id, user_b);
			const investment_c = await client_c.get_campaign_tier_investment_amount(investment_campaign_id, tier1_id, user_c);

			assert.isTrue(investment_b.eq(invest_amount), 'user B investment should match');
			assert.isTrue(investment_c.eq(invest_amount), 'user C investment should match');
		});

		it('handles investments in multiple tiers by same user', async () => {
			const invest_amount = new BN('1600000'); // Above tier 3 minimum

			await client_b.invest(investment_campaign_id, tier3_id, invest_amount);
			await mocknet.wait_n_blocks(1);

			const totals = await client_a.get_campaign_tier_totals(investment_campaign_id, tier3_id);
			const data = totals.value.value.data;
			assert.isTrue(data['total-investment'].value.eq(invest_amount), 'tier 3 investment should match');
			assert.isTrue(data['total-investors'].value.eq(new BN('1')), 'tier 3 should have 1 investor');

			const investment = await client_b.get_campaign_tier_investment_amount(investment_campaign_id, tier3_id, user_b);
			assert.isTrue(investment.eq(invest_amount), 'user B tier 3 investment should match');
		});

		it('handles over-payment in tier investments', async () => {
			const overpay_amount = new BN('2000000'); // Well above tier 2 minimum

			await client_c.invest(investment_campaign_id, tier2_id, overpay_amount);
			await mocknet.wait_n_blocks(1);

			const totals = await client_a.get_campaign_tier_totals(investment_campaign_id, tier2_id);
			const data = totals.value.value.data;
			assert.isTrue(data['total-investment'].value.eq(overpay_amount), 'should accept over-payment');
			assert.isTrue(data['total-investors'].value.eq(new BN('1')), 'should count over-payment investor');

			const investment = await client_c.get_campaign_tier_investment_amount(investment_campaign_id, tier2_id, user_c);
			assert.isTrue(investment.eq(overpay_amount), 'should record over-payment amount');
		});

		it('tracks total investment value across all tiers', async () => {
			const initial_total = await client_a.get_total_investment_value();

			// Add more investments
			await client_a.invest(investment_campaign_id, tier1_id, new BN('700000'));
			await client_c.invest(investment_campaign_id, tier2_id, new BN('1200000'));
			await mocknet.wait_n_blocks(1);

			const final_total = await client_a.get_total_investment_value();
			const expected_additional = new BN('700000').add(new BN('1200000')); // 1,900,000

			assert.isTrue(final_total.sub(initial_total).eq(expected_additional), 'total investment should increase correctly');
		});
	});

	describe('Time-Based Campaign Logic', () => {
		it('correctly identifies active vs expired campaigns', async () => {
			const short_campaign = {
				name: 'short campaign',
				description: 'campaign that expires quickly',
				link: 'https://short.local',
				goal: new BN('1000000'),
				duration: new BN('2') // Very short duration
			};

			await client_a.create_campaign(short_campaign);
			await mocknet.wait_n_blocks(1);
			const campaign_id = await client_a.get_total_campaigns();

			// Should be active initially
			assert.isTrue(await client_a.get_is_active_campaign(campaign_id), 'campaign should be active initially');

			// Wait for expiration
			await mocknet.wait_n_blocks(3); // Exceed duration

			// Should now be inactive due to expiration
			assert.isFalse(await client_a.get_is_active_campaign(campaign_id), 'campaign should be inactive after expiration');
		});

		it('handles campaigns that reach goal before expiration', async () => {
			const goal_campaign = {
				name: 'goal reached campaign',
				description: 'campaign that reaches goal quickly',
				link: 'https://goal.local',
				goal: new BN('1000000'),
				duration: new BN('1000')
			};

			await client_a.create_campaign(goal_campaign);
			await mocknet.wait_n_blocks(1);
			const campaign_id = await client_a.get_total_campaigns();

			// Add tier and invest to reach goal
			await client_a.add_tier({
				campaign_id: campaign_id,
				name: 'Goal Tier',
				description: 'Tier to reach goal',
				cost: 1000000
			});
			await mocknet.wait_n_blocks(1);

			const tier_id = await client_a.get_total_campaign_tiers(campaign_id);
			await client_b.invest(campaign_id, tier_id, new BN('1000000'));
			await mocknet.wait_n_blocks(1);

			// Campaign should become inactive once goal is reached
			assert.isFalse(await client_a.get_is_active_campaign(campaign_id), 'campaign should be inactive after goal reached');
		});
	});

	describe('Refund Scenarios Extended', () => {
		let refund_campaign_id;
		let refund_tier_id;

		before(async () => {
			const refund_campaign = {
				name: 'refund test campaign',
				description: 'campaign for testing refund scenarios',
				link: 'https://refund.local',
				goal: new BN('5000000'), // High goal that won't be reached
				duration: new BN('10000')
			};

			await client_a.create_campaign(refund_campaign);
			await mocknet.wait_n_blocks(1);
			refund_campaign_id = await client_a.get_total_campaigns();

			await client_a.add_tier({
				campaign_id: refund_campaign_id,
				name: 'Refund Tier',
				description: 'Tier for refund testing',
				cost: 200000
			});
			await mocknet.wait_n_blocks(1);
			refund_tier_id = await client_a.get_total_campaign_tiers(refund_campaign_id);
		});

		it('allows refunds for unsuccessful campaigns after expiration', async () => {
			// Invest in the campaign
			await client_b.invest(refund_campaign_id, refund_tier_id, new BN('300000'));
			await mocknet.wait_n_blocks(1);

			// Verify investment was recorded
			let totals = await client_a.get_campaign_tier_totals(refund_campaign_id, refund_tier_id);
			let data = totals.value.value.data;
			assert.isTrue(data['total-investment'].value.eq(new BN('300000')), 'investment should be recorded');

			// Wait for campaign to expire without reaching goal
			await mocknet.wait_n_blocks(10001);

			// Attempt refund
			const balance_before = await mocknet.balance(user_b);
			await client_b.refund(refund_campaign_id, refund_tier_id);
			await mocknet.wait_n_blocks(1);
			const balance_after = await mocknet.balance(user_b);

			// Verify refund was processed
			assert.isTrue(balance_after.gt(balance_before), 'user should receive refund');

			// Verify investment was removed from records
			totals = await client_a.get_campaign_tier_totals(refund_campaign_id, refund_tier_id);
			data = totals.value.value.data;
			assert.isTrue(data['total-investment'].value.eq(new BN('0')), 'investment should be removed');
			assert.isTrue(data['total-investors'].value.eq(new BN('0')), 'investor count should be reset');
		});

		it('prevents refunds for successful campaigns', async () => {
			const success_campaign = {
				name: 'success campaign',
				description: 'campaign that will succeed',
				link: 'https://success.local',
				goal: new BN('100000'),
				duration: new BN('1000')
			};

			await client_a.create_campaign(success_campaign);
			await mocknet.wait_n_blocks(1);
			const success_campaign_id = await client_a.get_total_campaigns();

			await client_a.add_tier({
				campaign_id: success_campaign_id,
				name: 'Success Tier',
				description: 'Tier for successful campaign',
				cost: 100000
			});
			await mocknet.wait_n_blocks(1);

			const success_tier_id = await client_a.get_total_campaign_tiers(success_campaign_id);
			await client_b.invest(success_campaign_id, success_tier_id, new BN('100000'));
			await mocknet.wait_n_blocks(1);

			// Campaign should succeed
			const status = await client_a.get_campaign_status(success_campaign_id);
			const status_data = status.value.value.data;
			assert.equal(status_data['target-reached'].type, ClarityType.BoolTrue, 'campaign should have reached target');

			// Attempt refund (should fail)
			const balance_before = await mocknet.balance(user_b);
			await client_b.refund(success_campaign_id, success_tier_id);
			await mocknet.wait_n_blocks(1);
			const balance_after = await mocknet.balance(user_b);

			// Balance should not change (refund should be blocked)
			assert.isTrue(balance_before.eq(balance_after), 'successful campaign should block refunds');
		});

		it('prevents refunds for non-existent investments', async () => {
			// Try to refund from a tier user never invested in
			const balance_before = await mocknet.balance(user_c);
			await client_c.refund(refund_campaign_id, refund_tier_id);
			await mocknet.wait_n_blocks(1);
			const balance_after = await mocknet.balance(user_c);

			// Balance should not change
			assert.isTrue(balance_before.eq(balance_after), 'non-investor should not receive refund');
		});
	});

	describe('Collection Security', () => {
		it('prevents collection from unsuccessful campaigns', async () => {
			const fail_campaign = {
				name: 'fail campaign',
				description: 'campaign that will not reach goal',
				link: 'https://fail.local',
				goal: new BN('10000000'), // Very high goal
				duration: new BN('1000')
			};

			await client_a.create_campaign(fail_campaign);
			await mocknet.wait_n_blocks(1);
			const fail_campaign_id = await client_a.get_total_campaigns();

			await client_a.add_tier({
				campaign_id: fail_campaign_id,
				name: 'Fail Tier',
				description: 'Tier for failed campaign',
				cost: 100000
			});
			await mocknet.wait_n_blocks(1);

			const fail_tier_id = await client_a.get_total_campaign_tiers(fail_campaign_id);
			await client_b.invest(fail_campaign_id, fail_tier_id, new BN('500000'));
			await mocknet.wait_n_blocks(1001); // Let campaign expire

			// Attempt collection (should fail)
			await client_a.collect(fail_campaign_id);
			await mocknet.wait_n_blocks(1);

			const status = await client_a.get_campaign_status(fail_campaign_id);
			const status_data = status.value.value.data;
			assert.equal(status_data['funded'].type, ClarityType.BoolFalse, 'failed campaign should not be funded');
		});

		it('prevents non-owners from collecting funds', async () => {
			const owner_campaign = {
				name: 'owner test campaign',
				description: 'campaign for testing collection ownership',
				link: 'https://owner.local',
				goal: new BN('500000'),
				duration: new BN('1000')
			};

			await client_a.create_campaign(owner_campaign);
			await mocknet.wait_n_blocks(1);
			const owner_campaign_id = await client_a.get_total_campaigns();

			await client_a.add_tier({
				campaign_id: owner_campaign_id,
				name: 'Owner Tier',
				description: 'Tier for ownership testing',
				cost: 500000
			});
			await mocknet.wait_n_blocks(1);

			const owner_tier_id = await client_a.get_total_campaign_tiers(owner_campaign_id);
			await client_b.invest(owner_campaign_id, owner_tier_id, new BN('500000'));
			await mocknet.wait_n_blocks(1);

			// Non-owner tries to collect (should fail silently or have no effect)
			const contract_balance_before = await mocknet.balance(contract_owner.stacksAddress + '.' + contract_name);
			await client_b.collect(owner_campaign_id);
			await mocknet.wait_n_blocks(1);
			const contract_balance_after = await mocknet.balance(contract_owner.stacksAddress + '.' + contract_name);

			// Contract balance should not change
			assert.isTrue(contract_balance_before.eq(contract_balance_after), 'non-owner should not be able to collect');
		});
	});

	describe('State Consistency', () => {
		it('maintains consistent global statistics', async () => {
			const initial_campaigns = await client_a.get_total_campaigns();
			const initial_investments = await client_a.get_total_investments();
			const initial_value = await client_a.get_total_investment_value();

			// Create multiple campaigns with investments
			for (let i = 0; i < 3; i++) {
				const campaign = {
					name: `Consistency Campaign ${i}`,
					description: `Campaign for testing state consistency ${i}`,
					link: `https://consistency${i}.local`,
					goal: new BN('1000000'),
					duration: new BN('5000')
				};

				await client_a.create_campaign(campaign);
				await mocknet.wait_n_blocks(1);
				const campaign_id = await client_a.get_total_campaigns();

				await client_a.add_tier({
					campaign_id: campaign_id,
					name: `Tier ${i}`,
					description: `Tier for campaign ${i}`,
					cost: 200000
				});
				await mocknet.wait_n_blocks(1);

				const tier_id = await client_a.get_total_campaign_tiers(campaign_id);
				await client_b.invest(campaign_id, tier_id, new BN('300000'));
				await mocknet.wait_n_blocks(1);
			}

			const final_campaigns = await client_a.get_total_campaigns();
			const final_investments = await client_a.get_total_investments();
			const final_value = await client_a.get_total_investment_value();

			// Verify increments are correct
			assert.isTrue(final_campaigns.sub(initial_campaigns).eq(new BN('3')), 'campaign count should increase by 3');
			assert.isTrue(final_investments.sub(initial_investments).eq(new BN('3')), 'investment count should increase by 3');
			assert.isTrue(final_value.sub(initial_value).eq(new BN('900000')), 'investment value should increase by 900,000');
		});

		it('handles concurrent campaign operations', async () => {
			// Create campaigns from different users
			const campaign1 = {
				name: 'Concurrent Campaign 1',
				description: 'First concurrent campaign',
				link: 'https://concurrent1.local',
				goal: new BN('1000000'),
				duration: new BN('10000')
			};

			const campaign2 = {
				name: 'Concurrent Campaign 2',
				description: 'Second concurrent campaign',
				link: 'https://concurrent2.local',
				goal: new BN('2000000'),
				duration: new BN('15000')
			};

			// Create both campaigns
			await client_a.create_campaign(campaign1);
			await client_b.create_campaign(campaign2);
			await mocknet.wait_n_blocks(1);

			const total_campaigns = await client_a.get_total_campaigns();

			// Both campaigns should exist and be separate
			const campaign1_data = await client_a.get_campaign(total_campaigns.sub(new BN('1')));
			const campaign2_data = await client_b.get_campaign(total_campaigns);

			assert.notEqual(getCVTypeString(campaign1_data), '(responseOk (optional none))', 'campaign 1 should exist');
			assert.notEqual(getCVTypeString(campaign2_data), '(responseOk (optional none))', 'campaign 2 should exist');

			const data1 = campaign1_data.value.value.data;
			const data2 = campaign2_data.value.value.data;

			assert.equal(cvToString(data1.name), '"Concurrent Campaign 1"', 'campaign 1 name should match');
			assert.equal(cvToString(data2.name), '"Concurrent Campaign 2"', 'campaign 2 name should match');
			assert.equal(cvToString(data1.fundraiser), user_a.stacksAddress, 'campaign 1 fundraiser should be user A');
			assert.equal(cvToString(data2.fundraiser), user_b.stacksAddress, 'campaign 2 fundraiser should be user B');
		});
	});

	describe('Input Validation', () => {
		it('handles edge cases in campaign information updates', async () => {
			const test_campaign = {
				name: 'Validation Test Campaign',
				description: 'Campaign for testing input validation',
				link: 'https://validation.local',
				goal: new BN('1000000'),
				duration: new BN('5000')
			};

			await client_a.create_campaign(test_campaign);
			await mocknet.wait_n_blocks(1);
			const campaign_id = await client_a.get_total_campaigns();

			// Test various edge cases for information updates
			const edge_cases = [
				{ description: '', link: 'https://empty-desc.local' }, // Empty description
				{ description: 'a'.repeat(100), link: 'https://long-desc.local' }, // Very long description
				{ description: 'normal desc', link: 'https://normal.local' } // Normal case
			];

			for (const test_case of edge_cases) {
				await client_a.update_campaign_information(campaign_id, test_case);
				await mocknet.wait_n_blocks(1);

				const info = await client_a.get_campaign_information(campaign_id);
				assert.notEqual(getCVTypeString(info), '(responseOk (optional none))', 'campaign info should exist');

				const data = info.value.value.data;
				assert.equal(cvToString(data.description), `"${test_case.description}"`, 'description should match update');
				assert.equal(cvToString(data.link), `"${test_case.link}"`, 'link should match update');
			}
		});

		it('validates tier information constraints', async () => {
			const tier_campaign = {
				name: 'Tier Validation Campaign',
				description: 'Campaign for testing tier validation',
				link: 'https://tier-validation.local',
				goal: new BN('2000000'),
				duration: new BN('10000')
			};

			await client_a.create_campaign(tier_campaign);
			await mocknet.wait_n_blocks(1);
			const campaign_id = await client_a.get_total_campaigns();

			// Test tier edge cases
			const tier_edge_cases = [
				{ name: 'A', description: 'Min name', cost: 1 }, // Minimum values
				{ name: 'A'.repeat(50), description: 'A'.repeat(100), cost: 1000000000 }, // Large values
				{ name: 'Normal Tier', description: 'Normal description', cost: 500000 } // Normal values
			];

			for (const tier_case of tier_edge_cases) {
				await client_a.add_tier({
					campaign_id: campaign_id,
					...tier_case
				});
				await mocknet.wait_n_blocks(1);

				const tier_id = await client_a.get_total_campaign_tiers(campaign_id);
				const tier = await client_a.get_campaign_tier(campaign_id, tier_id);

				assert.notEqual(getCVTypeString(tier), '(responseOk (optional none))', 'tier should be created');

				const data = tier.value.value.data;
				assert.equal(cvToString(data.name), `"${tier_case.name}"`, 'tier name should match');
				assert.equal(cvToString(data.cost), `u${tier_case.cost}`, 'tier cost should match');
			}
		});
	});
}).timeout(0);
