/*
 * @adonisjs/ally
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import {
  RedditScopes,
  RedditToken,
  ApiRequestContract,
  RedditDriverConfig,
  RedditDriverContract,
  RedirectRequestContract,
} from '@ioc:Adonis/Addons/Ally'
import { Oauth2Driver } from '../../AbstractDrivers/Oauth2'

/**
 * Reddit driver to login user via Reddit
 */
export class RedditDriver
  extends Oauth2Driver<RedditToken, RedditScopes>
  implements RedditDriverContract
{
  protected accessTokenUrl = 'https://www.reddit.com/api/v1/access_token'
  //@TODO: Include option to revoke token when logging out?
  protected revokeTokenUrl = 'https://www.reddit.com/api/v1/revoke_token'
  protected authorizeUrl = 'https://www.reddit.com/api/v1/authorize'
  protected userInfoUrl = 'https://oauth.reddit.com/api/v1/me'
  /**
   * The param name for the authorization code
   */
  protected codeParamName = 'code'

  /**
   * The param name for the error
   */
  protected errorParamName = 'error'

  /**
   * Cookie name for storing the "reddit_oauth_state"
   */
  protected stateCookieName = 'reddit_oauth_state'

  /**
   * Parameter name to be used for sending and receiving the state
   * from Reddit
   */
  protected stateParamName = 'state'

  /**
   * Parameter name for defining the scopes
   */
  protected scopeParamName = 'scope'

  /**
   * Scopes separator
   */
  protected scopesSeparator = ' '

  constructor(ctx: HttpContextContract, public config: RedditDriverConfig) {
    super(ctx, config)

    /**
     * Extremely important to call the following method to clear the
     * state set by the redirect request
     */
    this.loadState()
  }

  /**
   * Configuring the redirect request with defaults
   */
  protected configureRedirectRequest(request: RedirectRequestContract<RedditScopes>) {
    /**
     * Define user defined scopes or the default one's
     */
    request.scopes(this.config.scopes || ['identity'])

    request.param('response_type', 'code')
    //@TODO: option for permanant token and refresh?
    request.param('duration', 'temporary')
  }

  /**
   * Configuring the access token API request to send extra fields
   */
  protected configureAccessTokenRequest(request: ApiRequestContract) {
    /**
     * Send state to Reddit when request is not stateles
     */
    const buffer = Buffer.from(this.options.clientId + ':' + this.options.clientSecret)
    request.header('Authorization', 'Basic ' + buffer.toString('base64'))
    //@TODO: Remove client_id and client_secret fields from body (included in header)
    if (!this.isStateless) {
      request.field('state', this.stateCookieValue)
    }
  }

  /**
   * Returns the HTTP request with the authorization header set
   */
  protected getAuthenticatedRequest(url: string, token: string) {
    const request = this.httpClient(url)
    request.header('Authorization', `bearer ${token}`)
    request.header('Accept', 'application/json')
    request.parseAs('json')
    return request
  }

  /**
   * Fetches the user info from the Reddit API
   * https://reddit.com/developers/docs/resources/user#get-current-user
   */
  protected async getUserInfo(token: string, callback?: (request: ApiRequestContract) => void) {
    const request = this.getAuthenticatedRequest(this.config.userInfoUrl || this.userInfoUrl, token)
    if (typeof callback === 'function') {
      callback(request)
    }

    const body = await request.get()
    return {
      id: body.id,
      name: `${body.username}#${body.discriminator}`,
      nickName: body.username,
      avatarUrl: body.avatar
        ? `https://cdn.redditapp.com/avatars/${body.id}/${body.avatar}.${
            body.avatar.startsWith('a_') ? 'gif' : 'png'
          }`
        : `https://cdn.redditapp.com/embed/avatars/${body.discriminator % 5}.png`,
      email: body.email, // May not always be there (requires email scope)
      emailVerificationState:
        'verified' in body
          ? body.verified
            ? ('verified' as const)
            : ('unverified' as const)
          : ('unsupported' as const),
      original: body,
    }
  }

  /**
   * Find if the current error code is for access denied
   */
  public accessDenied(): boolean {
    const error = this.getError()
    if (!error) {
      return false
    }

    return error === 'access_denied'
  }

  /**
   * Returns details for the authorized user
   */
  public async user(callback?: (request: ApiRequestContract) => void) {
    const token = await this.accessToken(callback)
    const user = await this.getUserInfo(token.token, callback)

    return {
      ...user,
      token,
    }
  }

  /**
   * Finds the user by the access token
   */
  public async userFromToken(token: string, callback?: (request: ApiRequestContract) => void) {
    const user = await this.getUserInfo(token, callback)

    return {
      ...user,
      token: { token, type: 'bearer' as const },
    }
  }
}
