/*
 * @adonisjs/ally
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Route from '@ioc:Adonis/Core/Route'

Route.get('reddit', async ({ response }) => {
  return response.send('<a href="/reddit/redirect"> Login with Reddit</a>')
})

Route.get('/reddit/redirect', async ({ ally }) => {
  return ally.use('reddit').redirect((request) => {
    request.scopes(['identify', 'guilds'])
  })
})

Route.get('/reddit/callback', async ({ ally }) => {
  try {
    const reddit = ally.use('reddit')
    if (reddit.accessDenied()) {
      return 'Access was denied'
    }

    if (reddit.stateMisMatch()) {
      return 'Request expired. Retry again'
    }

    if (reddit.hasError()) {
      return reddit.getError()
    }

    const user = await reddit.user()
    return user
  } catch (error) {
    console.log({ error: error.response })
    throw error
  }
})
