import { authMiddleware } from './_auth.js'

export async function handler(event) {
  // check auth
  const auth = await authMiddleware(event)
  if (auth.statusCode) return auth // Unauthorized

  const user = auth.user

  // return protected data
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello ${user.email}, this is your profile!`
    }),
  }
}
