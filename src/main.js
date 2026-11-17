import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import './styles.css'

const baseUrl = import.meta.env.BASE_URL

const objects = [
  { name: 'Batelão', file: 'batelao_otimizado.glb', size: '6,5 MB' },
  { name: 'Baú de seringalista', file: 'bau_seringalista_otimizado.glb', size: '5,5 MB' },
  { name: 'Figurino do Exército', file: 'figurino_exercito_otimizado.glb', size: '5,5 MB' },
  { name: 'Marcador de Madeira', file: 'marcador_madeira_otimizado.glb', size: '5,0 MB' },
  { name: 'Péla de borracha', file: 'pela_borracha_otimizado.glb', size: '5,0 MB' },
  { name: 'Rádio antigo', file: 'radio_antigo_otimizado.glb', size: '5,3 MB' },
  { name: 'Relógio de ponto', file: 'relogio_otimizado.glb', size: '5,2 MB' }
]

const canvas = document.querySelector('#model-canvas')
const viewer = document.querySelector('#viewer')
const objectList = document.querySelector('#object-list')
const objectTitle = document.querySelector('#object-title')
const objectCounter = document.querySelector('#object-counter')
const modelSize = document.querySelector('#model-size')
const downloadLink = document.querySelector('#download-link')
const loading = document.querySelector('#loading')
const loadingText = document.querySelector('#loading-text')
const viewerError = document.querySelector('#viewer-error')
const rotateButton = document.querySelector('#rotate-button')
const resetButton = document.querySelector('#reset-button')
const fullscreenButton = document.querySelector('#fullscreen-button')

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.enablePan = false
controls.minDistance = 2.2
controls.maxDistance = 8
controls.autoRotate = true
controls.autoRotateSpeed = 1.25

scene.add(new THREE.HemisphereLight(0xffffff, 0x6d766e, 2.4))

const keyLight = new THREE.DirectionalLight(0xffffff, 3.2)
keyLight.position.set(4, 6, 5)
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0xd8e9ff, 1.7)
fillLight.position.set(-4, 2, -3)
scene.add(fillLight)

const rimLight = new THREE.DirectionalLight(0xffe6bd, 1.2)
rimLight.position.set(2, -2, -4)
scene.add(rimLight)

const modelRoot = new THREE.Group()
scene.add(modelRoot)

const loader = new GLTFLoader()
let activeIndex = 0
let loadSequence = 0

function modelUrl(item) {
  return `${baseUrl}models/${item.file}`
}

function renderCatalog() {
  objectList.replaceChildren()

  objects.forEach((item, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'object-button'
    button.dataset.index = index
    button.setAttribute('aria-current', index === activeIndex ? 'true' : 'false')
    button.innerHTML = `
      <span class="object-number">${String(index + 1).padStart(2, '0')}</span>
      <span class="object-meta">
        <strong>${item.name}</strong>
        <small>Modelo 3D · ${item.size}</small>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
    `
    button.addEventListener('click', () => selectObject(index))
    objectList.append(button)
  })
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return
    child.geometry?.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      if (!material) return
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose()
      })
      material.dispose()
    })
  })
}

function clearModel() {
  while (modelRoot.children.length) {
    const child = modelRoot.children[0]
    modelRoot.remove(child)
    disposeObject(child)
  }
}

function fitModel(model) {
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxAxis = Math.max(size.x, size.y, size.z)

  if (!Number.isFinite(maxAxis) || maxAxis === 0) {
    throw new Error('O modelo não possui dimensões válidas.')
  }

  const scale = 2.7 / maxAxis
  model.scale.setScalar(scale)
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale)

  camera.position.set(3.7, 2.4, 4.5)
  controls.target.set(0, 0, 0)
  controls.update()
}

function showLoading(percent) {
  loading.hidden = false
  viewerError.hidden = true
  loadingText.textContent = Number.isFinite(percent)
    ? `Carregando modelo… ${percent}%`
    : 'Carregando modelo…'
}

async function loadModel(item) {
  const sequence = ++loadSequence
  showLoading()

  try {
    const gltf = await loader.loadAsync(
      modelUrl(item),
      (event) => {
        if (sequence !== loadSequence || !event.total) return
        showLoading(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      }
    )

    if (sequence !== loadSequence) {
      disposeObject(gltf.scene)
      return
    }

    clearModel()
    fitModel(gltf.scene)
    modelRoot.add(gltf.scene)
    loading.hidden = true
  } catch (error) {
    if (sequence !== loadSequence) return
    console.error('Erro ao carregar modelo 3D:', error)
    loading.hidden = true
    viewerError.hidden = false
  }
}

function selectObject(index) {
  if (index < 0 || index >= objects.length) return

  activeIndex = index
  const item = objects[index]

  objectTitle.textContent = item.name
  objectCounter.textContent = `Objeto ${index + 1} de ${objects.length}`
  modelSize.textContent = `${item.size} · Formato GLB`
  downloadLink.href = modelUrl(item)
  downloadLink.download = item.file

  objectList.querySelectorAll('.object-button').forEach((button, buttonIndex) => {
    button.setAttribute('aria-current', buttonIndex === index ? 'true' : 'false')
  })

  loadModel(item)
}

function resizeRenderer() {
  const width = viewer.clientWidth
  const height = viewer.clientHeight
  if (!width || !height) return

  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

rotateButton.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate
  rotateButton.classList.toggle('active', controls.autoRotate)
  rotateButton.setAttribute('aria-pressed', String(controls.autoRotate))
})

resetButton.addEventListener('click', () => {
  camera.position.set(3.7, 2.4, 4.5)
  controls.target.set(0, 0, 0)
  controls.update()
})

fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await viewer.requestFullscreen()
    }
  } catch (error) {
    console.warn('Tela cheia não disponível:', error)
  }
})

document.addEventListener('fullscreenchange', () => {
  fullscreenButton.lastChild.textContent = document.fullscreenElement ? ' Sair da tela cheia' : ' Tela cheia'
  setTimeout(resizeRenderer, 50)
})

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    selectObject((activeIndex + 1) % objects.length)
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    selectObject((activeIndex - 1 + objects.length) % objects.length)
  }
})

new ResizeObserver(resizeRenderer).observe(viewer)

renderCatalog()
selectObject(0)
resizeRenderer()
animate()
