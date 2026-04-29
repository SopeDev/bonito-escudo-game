/* Bonito con escudo — Phaser 3. Balas desde arriba/abajo/izq/der; el toque orienta al personaje. */

;(function () {
  const EDGE = {
    TOP: 'top',
    RIGHT: 'right',
    BOTTOM: 'bottom',
    LEFT: 'left'
  }

  const FACING = {
    UP: 'up',
    RIGHT: 'right',
    DOWN: 'down',
    LEFT: 'left'
  }

  const edgeToFacing = {
    [EDGE.TOP]: FACING.UP,
    [EDGE.RIGHT]: FACING.RIGHT,
    [EDGE.BOTTOM]: FACING.DOWN,
    [EDGE.LEFT]: FACING.LEFT
  }

  class MainScene extends Phaser.Scene {
    constructor() {
      super({ key: 'MainScene' })
    }

    resetRunState() {
      this.facing = FACING.UP
      this.score = 0
      this.lives = 3
      this.spawnDelayMs = 900
      this.lastSpawnEdge = null
      this.gameActive = true
      this.pendingSpawn = null
    }

    pickSpawnEdge() {
      const all = [EDGE.TOP, EDGE.RIGHT, EDGE.BOTTOM, EDGE.LEFT]
      const pool = this.lastSpawnEdge ? all.filter(e => e !== this.lastSpawnEdge) : all.slice()
      const edge = pool[Phaser.Math.Between(0, pool.length - 1)]
      this.lastSpawnEdge = edge
      return edge
    }

    clearSpawnTimer() {
      if (this.pendingSpawn) {
        this.pendingSpawn.remove(false)
        this.pendingSpawn = null
      }
    }

    onSceneShutdown() {
      this.clearSpawnTimer()
      this.input.off('pointerdown', this.onPointerDown, this)
    }

    create() {
      this.resetRunState()

      this.events.once('shutdown', this.onSceneShutdown, this)

      const { width, height } = this.scale

      this.cx = width / 2
      this.cy = height / 2

      this.bodyRadius = Math.min(width, height) * 0.065
      this.shieldInner = this.bodyRadius + 6
      this.shieldOuter = this.bodyRadius + 46
      this.hitRadius = this.bodyRadius * 0.92

      this.bg = this.add.rectangle(this.cx, this.cy, width, height, 0x16213e)

      this.shields = this.add.graphics()
      this.bunny = this.add.graphics()
      this.bunny.setDepth(20)
      this.shields.setDepth(21)

      // Sin física Arcade para las balas: en algunos navegadores / Scale FIT las velocidades
      // del body no se integran bien cuando el sprite sale de un PhysicsGroup. Movimiento manual = fiable.
      this.bullets = this.add.group()

      if (!this.textures.exists('bulletTex')) {
        const g = this.make.graphics({ x: 0, y: 0, add: false })
        g.fillStyle(0xff4757, 1)
        g.fillCircle(10, 10, 9)
        g.lineStyle(3, 0xffffff, 0.85)
        g.strokeCircle(10, 10, 9)
        g.generateTexture('bulletTex', 20, 20)
        g.destroy()
      }

      this.drawCharacter()

      this.input.on('pointerdown', this.onPointerDown, this)

      this.scheduleNextSpawn()

      this.syncHud()
    }

    onPointerDown(pointer) {
      const dx = pointer.x - this.cx
      const dy = pointer.y - this.cy

      if (dx === 0 && dy === 0) return

      if (Math.abs(dx) >= Math.abs(dy)) {
        this.facing = dx > 0 ? FACING.RIGHT : FACING.LEFT
      } else {
        this.facing = dy > 0 ? FACING.DOWN : FACING.UP
      }
      this.drawCharacter()
    }

    facingAngleRad() {
      switch (this.facing) {
        case FACING.RIGHT:
          return 0
        case FACING.DOWN:
          return Math.PI / 2
        case FACING.LEFT:
          return Math.PI
        default:
          return -Math.PI / 2
      }
    }

    drawCharacter() {
      const g = this.bunny
      g.clear()

      const ang = this.facingAngleRad()

      const bodyX = this.cx
      const bodyY = this.cy
      const br = this.bodyRadius

      g.fillStyle(0xf4a7c5, 1)
      g.fillCircle(bodyX, bodyY, br)

      const earL = { x: bodyX - br * 0.55, y: bodyY - br * 1.05 }
      const earR = { x: bodyX + br * 0.55, y: bodyY - br * 1.05 }
      g.fillEllipse(earL.x, earL.y, br * 0.55, br * 1.15)
      g.fillEllipse(earR.x, earR.y, br * 0.55, br * 1.15)

      g.fillStyle(0xffd6e5, 1)
      g.fillEllipse(earL.x - br * 0.08, earL.y + br * 0.15, br * 0.28, br * 0.55)
      g.fillEllipse(earR.x + br * 0.08, earR.y + br * 0.15, br * 0.28, br * 0.55)

      g.fillStyle(0x2d2d44, 1)
      g.fillCircle(bodyX - br * 0.35, bodyY - br * 0.12, br * 0.14)
      g.fillCircle(bodyX + br * 0.35, bodyY - br * 0.12, br * 0.14)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(bodyX - br * 0.38, bodyY - br * 0.16, br * 0.05)
      g.fillCircle(bodyX + br * 0.32, bodyY - br * 0.16, br * 0.05)

      g.fillStyle(0xff7eb3, 1)
      g.fillEllipse(bodyX, bodyY + br * 0.25, br * 0.35, br * 0.22)

      const sg = this.shields
      sg.clear()

      const sx = this.cx + Math.cos(ang) * (this.shieldInner + 14)
      const sy = this.cy + Math.sin(ang) * (this.shieldInner + 14)

      sg.lineStyle(10, 0xc9a227, 1)
      sg.beginPath()
      sg.arc(sx, sy, 22, ang + Math.PI * 0.65, ang + Math.PI * 1.35, false)
      sg.strokePath()

      sg.fillStyle(0x8fd3ff, 0.35)
      sg.fillCircle(sx, sy, 18)

      sg.lineStyle(4, 0xffffff, 0.75)
      sg.strokeCircle(sx, sy, 18)
    }

    spawnBullet() {
      const edge = this.pickSpawnEdge()
      const { width, height } = this.scale
      let x = this.cx
      let y = this.cy
      const margin = 24

      switch (edge) {
        case EDGE.TOP:
          x = Phaser.Math.Between(margin, width - margin)
          y = margin
          break
        case EDGE.BOTTOM:
          x = Phaser.Math.Between(margin, width - margin)
          y = height - margin
          break
        case EDGE.LEFT:
          x = margin
          y = Phaser.Math.Between(margin, height - margin)
          break
        default:
          x = width - margin
          y = Phaser.Math.Between(margin, height - margin)
          break
      }

      const bullet = this.add.sprite(x, y, 'bulletTex')
      bullet.setOrigin(0.5)
      bullet.setDepth(10)

      const speed = Phaser.Math.Between(160, 240)
      const angle = Phaser.Math.Angle.Between(x, y, this.cx, this.cy)
      bullet.vx = Math.cos(angle) * speed
      bullet.vy = Math.sin(angle) * speed

      bullet.spawnEdge = edge

      this.bullets.add(bullet)

      const minGap = 520
      const ramp = 5
      this.spawnDelayMs = Math.max(minGap, this.spawnDelayMs - ramp)
    }

    scheduleNextSpawn() {
      if (!this.gameActive) return
      this.clearSpawnTimer()
      this.pendingSpawn = this.time.delayedCall(this.spawnDelayMs, () => {
        this.pendingSpawn = null
        if (!this.gameActive || !this.sys.isActive()) return
        this.spawnBullet()
        this.scheduleNextSpawn()
      })
    }

    syncHud() {
      const scoreEl = document.getElementById('score')
      const livesEl = document.getElementById('lives')
      if (scoreEl) scoreEl.textContent = `Puntos: ${this.score}`
      if (livesEl) {
        const hearts = Math.max(0, this.lives)
        livesEl.textContent = '❤️'.repeat(hearts) + (hearts === 0 ? ' 💔' : '')
      }
    }

    hitPlayer() {
      this.lives -= 1
      this.syncHud()
      this.cameras.main.shake(120, 0.012)
      if (this.lives <= 0) {
        this.gameActive = false
        this.clearSpawnTimer()
        this.physics.pause()
        this.bullets.clear(true, true)
        this.showGameOver()
      }
    }

    showGameOver() {
      const { width, height } = this.scale
      const overlay = this.add.rectangle(this.cx, this.cy, width, height, 0x000000, 0.55)
      overlay.setDepth(50)

      const txt = this.add
        .text(this.cx, this.cy - 24, '¡Se acabó!', {
          fontFamily: 'system-ui, Segoe UI, sans-serif',
          fontSize: '28px',
          fontStyle: 'bold',
          color: '#ffffff'
        })
        .setOrigin(0.5)
        .setDepth(51)

      const sub = this.add
        .text(this.cx, this.cy + 22, `Puntos: ${this.score}\nToca para reiniciar`, {
          fontFamily: 'system-ui, Segoe UI, sans-serif',
          fontSize: '16px',
          color: '#eaeaea',
          align: 'center'
        })
        .setOrigin(0.5)
        .setDepth(51)

      const restart = () => {
        overlay.destroy()
        txt.destroy()
        sub.destroy()

        this.resetRunState()
        this.syncHud()

        this.physics.resume()
        this.scene.restart()
      }

      this.input.once('pointerdown', restart)
    }

    update(time, delta) {
      const dt = delta / 1000

      this.bullets.children.iterate(bullet => {
        if (!bullet || !bullet.active) return

        if (this.gameActive && typeof bullet.vx === 'number' && typeof bullet.vy === 'number') {
          bullet.x += bullet.vx * dt
          bullet.y += bullet.vy * dt
        }

        const dist = Phaser.Math.Distance.Between(bullet.x, bullet.y, this.cx, this.cy)
        const needFace = edgeToFacing[bullet.spawnEdge]
        const blocking = this.facing === needFace

        if (blocking && dist < this.shieldOuter && dist > this.shieldInner) {
          const bx = bullet.x
          const by = bullet.y
          bullet.destroy()
          this.score += 10
          this.syncHud()
          const burst = this.add.circle(bx, by, 12, 0xfff176, 0.85)
          this.tweens.add({
            targets: burst,
            alpha: 0,
            scale: 2,
            duration: 220,
            onComplete: () => burst.destroy()
          })
          return
        }

        if (dist < this.hitRadius) {
          bullet.destroy()
          this.hitPlayer()
        }
      })
    }
  }

  const parent = 'game'

  window.bonitoEscudoGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#16213e',
    physics: {
      default: 'arcade',
      arcade: { debug: false }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      parent,
      width: 360,
      height: 560
    },
    scene: [MainScene]
  })
})()
