import { createServer } from '../../server.js'
import { config } from '../../../config/config.js'

async function startServer() {
  const server = await createServer()
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    { port: config.get('port') },
    'Access your frontend on http://localhost'
  )

  return server
}

export { startServer }
