import { hasDb } from '../server/db.js'
import { send } from '../server/http.js'
export default function handler(req, res) {
  send(res, 200, { ok: true, database: hasDb(), live: !!process.env.NTA_API_KEY })
}
