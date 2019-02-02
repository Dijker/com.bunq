'use strict';

const Homey = require('homey');
const { OAuth2Driver } = require('homey-oauth2app');

module.exports = class BunqUserDriver extends OAuth2Driver {

	onOAuth2Init() {
		this.log('BunqUserDriver has been inited');
	}

	async onPairListDevices({ oAuth2Client }) {
  	await oAuth2Client.createDevice();
  	const session = await oAuth2Client.createSession();
    const users = await oAuth2Client.getUsers();

    return users.map(user => {
      return {
        name: user.UserApiKey.granted_by_user.UserPerson.display_name,
        data: {
          userId: user.UserApiKey.id,
        }
      }
    });
	}

}