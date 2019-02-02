'use strict';

const Homey = require('homey');
const { URL } = require('url');
const { OAuth2Client, fetch } = require('homey-oauth2app');

module.exports = class BunqOAuth2Client extends OAuth2Client {

  static get API_URL() {
    return 'https://api.bunq.com';
  }

  static getHeaders() {
    return {
      'Cache-Control': 'no-cache',
      'User-Agent': 'Homey/com.bunq',
      'X-Bunq-Language': 'en_US',
      'X-Bunq-Region': 'en_US',
      'X-Bunq-Client-Request-Id': String(Math.random()),
      'X-Bunq-Geolocation': '0 0 0 0 000',
    }
  }

  static async getSignature({ method, path, headers, body }) {
    const headersSorted = Object.keys(headers).map(key => {
      return `${key}: ${headers[key]}`;
    });
    headersSorted.sort();

    const payload = `${method.toUpperCase()} ${path}\n${headersSorted.join('\n')}\n\n${body || ''}`;
    //console.log('---');
    //console.log(payload)
    //console.log('---');
    return Homey.app.signPayload(Buffer.from(payload));
  }

  static async createInstallation({ publicKey }) {
		const res = await fetch(`${this.API_URL}/v1/installation`, {
  		method: 'post',
  		headers: {
        ...this.getHeaders(),
  		},
  		body: JSON.stringify({
    		client_public_key: publicKey,
  		}),
		});
		const json = await res.json();
		if( !res.ok )
		  throw new Error((json.Error && json.Error[0] && json.Error[0].error_description_translated ) || 'Unknown Error');

		if( !json.Response || !json.Response[1] || !json.Response[1].Token )
		  throw new Error('Missing Token');

    return json.Response[1].Token.token;
  }

  async createDevice() {
    const token = await this.getToken();
    if(!token)
      throw new OAuth2Error('Missing Token');
    const { access_token } = token;

    const authToken = await Homey.app.getToken();
    const method = 'post';
    const path = `/v1/device-server`;
    const body = JSON.stringify({
      secret: access_token,
      description: 'Homey',
      permitted_ips: [ '*' /*, '217.19.28.104'*/ ],
    });
    const headers = {
      ...this.constructor.getHeaders(),
      'X-Bunq-Client-Authentication': authToken,
    };

    headers['X-Bunq-Client-Signature'] = await this.constructor.getSignature({
      method,
      path,
      headers,
      body,
    });

		const res = await fetch(`${this.constructor.API_URL}${path}`, {
  		method,
  		body,
  		headers,
		});
		const json = await res.json();
		if( !res.ok )
		  throw new Error((json.Error && json.Error[0] && json.Error[0].error_description_translated ) || 'Unknown Error');

  }

  async createSession() {
    console.log('createSession()');

    const token = await this.getToken();
    if(!token)
      throw new OAuth2Error('Missing Token');
    const { access_token } = token;

    const authToken = await Homey.app.getToken();
    const method = 'post';
    const path = `/v1/session-server`;
    const body = JSON.stringify({
      secret: access_token,
    });
    const headers = {
      ...this.constructor.getHeaders(),
      'X-Bunq-Client-Authentication': authToken,
    };

    headers['X-Bunq-Client-Signature'] = await this.constructor.getSignature({
      method,
      path,
      headers,
      body,
    });

		const res = await fetch(`${this.constructor.API_URL}${path}`, {
  		method,
  		body,
  		headers,
		});
		const json = await res.json();
		if( !res.ok )
		  throw new Error((json.Error && json.Error[0] && json.Error[0].error_description_translated ) || 'Unknown Error');

		const { Response } = json;
		this._sessionToken = Response[1].Token.token;
		console.log('Got session token:', this._sessionToken)
		return Response;
  }

  async onGetTokenByCode({ code }) {
    const url = new URL(this._tokenUrl);

		url.searchParams.append('grant_type', 'authorization_code');
		url.searchParams.append('client_id', this._clientId);
		url.searchParams.append('client_secret', this._clientSecret);
		url.searchParams.append('code', code);
		url.searchParams.append('redirect_uri', this._redirectUrl);

		const response = await fetch(url, {
  		method: 'POST',
		});
		if(!response.ok)
		  throw new Error(`Invalid Response (${response.status})`);

		this._token = await this.onHandleGetTokenByCodeResponse({ response });
		return this.getToken();
  }

  async onRequestHeaders({ headers }) {
    return headers;
  }

  async onBuildRequest({ method, path, json, body, query, headers = {} }) {
    const { url, opts } = await super.onBuildRequest({ method, path, json, body, query, headers });

    if( !this._sessionToken )
      await this.createSession();

    opts.headers = {
      ...opts.headers,
      ...this.constructor.getHeaders(),
      'X-Bunq-Client-Authentication': this._sessionToken,
    };

    opts.headers['X-Bunq-Client-Signature'] = await this.constructor.getSignature({
      method,
      path,
      body: opts.body,
      headers: opts.headers,
    });

    return {
      url,
      opts,
    }
  }

  async onHandleResult({ result }) {
    return result.Response;
  }

  async onHandleNotOK({ body, status }) {
		throw new Error((body.Error && body.Error[0] && body.Error[0].error_description_translated ) || 'Unknown Error');
  }

  async getUsers() {
    return this.get({
      path: '/v1/user',
    });
  }

  async getUser({ userId }) {
    return this.get({
      path: `/v1/user/${userId}`,
    });
  }

  async getInvoices({ userId }) {
    return this.get({
      path: `/v1/user/${userId}/invoice`,
    });
  }

  async getEvents({ userId }) {
    return this.get({
      path: `/v1/user/${userId}/event`,
    });
  }

  async getMonetaryAccounts({ userId }) {
    return this.get({
      path: `/v1/user/${userId}/monetary-account`,
    });
  }

}