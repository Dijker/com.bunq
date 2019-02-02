'use strict';

const Homey = require('homey');
const { OAuth2App } = require('homey-oauth2app');
const BunqOAuth2Client = require('./lib/BunqOAuth2Client');
const NodeRSA = require('node-rsa');

module.exports = class BunqApp extends OAuth2App {

	onOAuth2Init() {

		this.enableOAuth2Debug();
		this.setOAuth2Config({
  		apiUrl: BunqOAuth2Client.API_URL,
  		client: BunqOAuth2Client,
  		tokenUrl: 'https://api.oauth.bunq.com/v1/token',
  		authorizationUrl: 'https://oauth.bunq.com/auth',
		});

		this.keys = Homey.ManagerSettings.get('keys');
		if( this.keys ) {
  		this.log('Existing keys found');
    } else {
  		this.log('No keys found, generating...');
      const key = new NodeRSA({ b: 2048 });
      const publicKey = key.exportKey('pkcs8-public-pem').toString();
      const privateKey = key.exportKey('pkcs8-private-pem').toString();
      const keys = { publicKey, privateKey };

      this.log('Keys generated. Creating installation...');

      BunqOAuth2Client.createInstallation({
        publicKey,
      }).then(async token => {
        keys.token = token;
        Homey.ManagerSettings.set('keys', keys);
        this.keys = keys;

        this.log('Created installation');
      }).catch(err => {
        this.error('Error while creating installation');
        this.error(err);
      });
		}

		this.log('BunqApp is running...');
	}

	async signPayload( buf ) {
  	if(!this.keys)
  	  throw new Error('No signing keys available');

    const { privateKey } = this.keys;
    const key = new NodeRSA();
    key.importKey(privateKey, 'pkcs8-private');
    return key.sign(buf, 'base64');
	}

	async getToken() {
  	if(!this.keys)
  	  throw new Error('No signing keys available');

    return this.keys.token;
	}

}