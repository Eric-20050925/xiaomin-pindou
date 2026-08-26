const MODEL_ID = 'onnx-community/ormbg-ONNX'

export type SubjectProgress = {
  stage: 'loading' | 'extracting'
  progress: number
}

type ProgressListener = (progress: SubjectProgress) => void

const listeners = new Set<ProgressListener>()
let lastDownloadProgress = 0

const publish = (progress: SubjectProgress) => {
  listeners.forEach((listener) => listener(progress))
}

async function createRemover() {
  const { pipeline } = await import('@huggingface/transformers')
  return pipeline('background-removal', MODEL_ID, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (info) => {
      if (info.status === 'progress_total' || info.status === 'progress') {
        lastDownloadProgress = Math.round(info.progress)
        publish({ stage: 'loading', progress: lastDownloadProgress })
      }
      if (info.status === 'ready') {
        lastDownloadProgress = 100
        publish({ stage: 'loading', progress: 100 })
      }
    },
  })
}

let removerPromise: ReturnType<typeof createRemover> | null = null

const loadImageFromBlob = (blob: Blob) => new Promise<{ image: HTMLImageElement; url: string }>((resolve, reject) => {
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.onload = () => resolve({ image, url })
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('主体图片生成失败'))
  }
  image.src = url
})

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob)
    else reject(new Error('主体图片生成失败'))
  }, 'image/png')
})

async function cropToVisibleSubject(source: Blob) {
  const loaded = await loadImageFromBlob(source)
  const canvas = document.createElement('canvas')
  canvas.width = loaded.image.naturalWidth
  canvas.height = loaded.image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('当前浏览器无法处理主体图片')
  context.drawImage(loaded.image, 0, 0)
  URL.revokeObjectURL(loaded.url)

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] < 20) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < minX || maxY < minY) throw new Error('没有识别到清晰的主体')

  const subjectWidth = maxX - minX + 1
  const subjectHeight = maxY - minY + 1
  const padding = Math.round(Math.max(subjectWidth, subjectHeight) * 0.045)
  const cropX = Math.max(0, minX - padding)
  const cropY = Math.max(0, minY - padding)
  const cropRight = Math.min(canvas.width, maxX + padding + 1)
  const cropBottom = Math.min(canvas.height, maxY + padding + 1)
  const cropWidth = cropRight - cropX
  const cropHeight = cropBottom - cropY

  const result = document.createElement('canvas')
  result.width = cropWidth
  result.height = cropHeight
  const resultContext = result.getContext('2d')
  if (!resultContext) throw new Error('当前浏览器无法裁剪主体图片')
  resultContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
  return canvasToBlob(result)
}

export async function extractMainSubject(
  sourceUrl: string,
  onProgress: ProgressListener,
): Promise<{ image: HTMLImageElement; url: string }> {
  listeners.add(onProgress)
  onProgress({ stage: 'loading', progress: lastDownloadProgress })

  try {
    removerPromise ??= createRemover()
    const remover = await removerPromise
    publish({ stage: 'extracting', progress: 100 })
    const output = await remover(sourceUrl)
    const subjectBlob = await output.toBlob('image/png')
    const croppedBlob = await cropToVisibleSubject(subjectBlob)
    return loadImageFromBlob(croppedBlob)
  } catch (error) {
    removerPromise = null
    throw error
  } finally {
    listeners.delete(onProgress)
  }
}
