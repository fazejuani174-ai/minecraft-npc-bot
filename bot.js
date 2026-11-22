
const mineflayer = require('mineflayer')
const { neoForgeHandshake } = require('minecraft-protocol-forge')

const CONFIG = {
  host: 'kageadventure.seedloaf.gg',
  port: 25565,
  username: 'ServidorNPC',
  version: '1.21.1',
  auth: 'offline',
  reconnectDelay: 25000,
  interval: 45000
}

let bot = null
let reconnectTimer = null
let routineTimer = null
let busy = false

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function npcRoutine(currentBot) {
  if (busy || !currentBot.entity) return
  busy = true

  let chest = null

  try {
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
    if (chest) chest.close()
  } finally {
    if (currentBot.entity) {
      currentBot.setControlState('jump', false)
    }
    busy = false
  }
}

function createBot() {
  console.log('[NPC] Conectando al servidor...')

  const currentBot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    auth: CONFIG.auth
  })

  bot = currentBot

  neoForgeHandshake(currentBot._client, {
    autoNegotiate: true
  })

  currentBot.once('spawn', () => {
    console.log('[NPC] ¡CONECTADO A KAGE ADVENTURE!')

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

    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        createBot()
      }, CONFIG.reconnectDelay)
    }
  })
}

createBot()


createBot()
