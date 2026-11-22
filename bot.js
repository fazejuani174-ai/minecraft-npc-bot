
const mineflayer = require('mineflayer')

const forge = require('minecraft-protocol-forge')

console.log('[DEBUG] Exportaciones Forge:', Object.keys(forge))

const neoForgeHandshake = forge.neoForgeHandshake

if (typeof neoForgeHandshake !== 'function') {
  throw new Error(
    'No se ha encontrado neoForgeHandshake. Revisa la dependencia.'
  )
}

const CONFIG = {
  host: process.env.MC_HOST || 'kageadventure.seedloaf.gg',
  port: Number(process.env.MC_PORT || 25565),
  username: process.env.MC_USERNAME || 'ServidorNPC',
  version: '1.21.1',
  auth: 'offline',
  reconnectDelay: 25000,
  interval: 45000
}

let bot = null
let reconnectTimer = null
let routineTimer = null
let busy = false
let stopping = false

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function npcRoutine(currentBot) {
  if (busy || !currentBot.entity) return

  busy = true
  let chest = null

  try {
    console.log('[NPC] Iniciando rutina')

    const block = currentBot.findBlock({
      matching: b => b.name === 'chest',
      maxDistance: 5
    })

    if (block) {
      console.log('[NPC] Cofre encontrado')

      chest = await currentBot.openChest(block)

      console.log('[NPC] Cofre abierto')
      await sleep(2000)

      chest.close()
      chest = null

      console.log('[NPC] Cofre cerrado')
    } else {
      console.log('[NPC] No hay cofres cerca')
    }

    await sleep(1000)

    if (currentBot.entity) {
      currentBot.setControlState('jump', true)
      await sleep(500)
      currentBot.setControlState('jump', false)

      console.log('[NPC] Salto completado')
    }

  } catch (err) {
    console.log('[NPC] Error:', err.message)

    if (chest) {
      try {
        chest.close()
      } catch (_) {}
    }

  } finally {
    if (currentBot.entity) {
      currentBot.setControlState('jump', false)
    }

    busy = false
  }
}

function createBot() {
  if (stopping) return

  console.log('[NPC] Conectando a Kage Adventure...')

  const currentBot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    auth: CONFIG.auth
  })

  bot = currentBot

  try {
    neoForgeHandshake(currentBot._client, {
      autoNegotiate: true
    })

    console.log('[NPC] Negociación NeoForge preparada')

  } catch (err) {
    console.log('[NPC] Error en handshake:', err)
    currentBot.quit()
    return
  }

  currentBot.once('spawn', () => {
    console.log('[NPC] CONECTADO A KAGE ADVENTURE')

    if (routineTimer) clearInterval(routineTimer)

    busy = false

    npcRoutine(currentBot)

    routineTimer = setInterval(() => {
      npcRoutine(currentBot)
    }, CONFIG.interval)
  })

  currentBot.on('chat', (username, message) => {
    if (username !== currentBot.username) {
      console.log(`[CHAT] ${username}: ${message}`)
    }
  })

  currentBot.on('kicked', reason => {
    console.log('[NPC] Expulsado:', reason)
  })

  currentBot.on('error', err => {
    console.log('[NPC] Error:', err.message)
  })

  currentBot.on('end', reason => {
    console.log('[NPC] Desconectado:', reason)

    if (routineTimer) clearInterval(routineTimer)
    routineTimer = null

    busy = false

    if (bot === currentBot) bot = null

    if (!stopping && !reconnectTimer) {
      console.log('[NPC] Reconectando en 25 segundos')

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        createBot()
      }, CONFIG.reconnectDelay)
    }
  })
}

function shutdown() {
  stopping = true

  if (routineTimer) clearInterval(routineTimer)
  if (reconnectTimer) clearTimeout(reconnectTimer)

  if (bot) bot.quit('NPC apagándose')

  setTimeout(() => process.exit(0), 1000)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

createBot()
