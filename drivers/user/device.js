'use strict';

const Homey = require('homey');
const { OAuth2Device } = require('homey-oauth2app');

const SYNC_FLOW_TOKENS_INTRVAL = 1000 * 60 * 5; // 5 min

module.exports = class BunqUserDevice extends OAuth2Device {

	onOAuth2Init() {
		this.log('BunqUserDevice has been inited');

    this.flowTokens = {};

    this.syncFlowTokens = this.syncFlowTokens.bind(this);
    this.syncFlowTokens();
    this.syncFlowTokensInterval = setInterval(this.syncFlowTokens, SYNC_FLOW_TOKENS_INTRVAL);

	}

	syncFlowTokens() {
		const { userId } = this.getData();
  	this.oAuth2Client.getMonetaryAccounts({ userId }).then(accounts => {
    	accounts.forEach(account => {
      	Object.values(account).forEach(account => {
        	const {
          	id: accountId,
          	description,
          	balance,
          } = account;

          if( !this.flowTokens[accountId] ) {
            this.flowTokens[accountId] = new Homey.FlowToken(`${userId}-${accountId}`, {
              title: `${this.getName()} - ${description} (${balance.currency})`,
              type: 'number',
            }).register();
          }

          this.flowTokens[accountId].then(flowToken => {
            return flowToken.setValue(parseFloat(balance.value));
          }).catch(this.error);
        });
    	});
		}).catch(this.error);
	}

}