// Estado compartido entre componentes del bot
const sessions = {}
let _sock = null

module.exports = {
  sessions,
  getSock: () => _sock,
  setSock: (sock) => { _sock = sock },
}
