import { useEffect } from 'react'
import {
  ArrowRight,
  Download,
  ExternalLink,
  ImagePlus,
  Palette,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import './LandingPage.css'
import { BeadHeroCanvas } from './components/BeadHeroCanvas'
import { CREATOR_AVATAR_URL, CREATOR_HOME_URL, CREATOR_NAME } from './config/creator'
import { palette } from './data/palette'

type LandingPageProps = {
  onStart: () => void
}

const showcaseColors = ['A19', 'A26', 'B5', 'B8', 'C20', 'D16', 'E12', 'F12', 'G6', 'H10']

export function LandingPage({ onStart }: LandingPageProps) {
  useEffect(() => {
    document.body.classList.add('landing-visible')
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.16 })
    revealItems.forEach((item) => {
      if (reduceMotion) item.classList.add('is-visible')
      else observer.observe(item)
    })

    return () => {
      document.body.classList.remove('landing-visible')
      observer.disconnect()
    }
  }, [])

  const featuredPalette = showcaseColors
    .map((code) => palette.find((color) => color.code === code))
    .filter((color) => color !== undefined)

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="小民拼豆首页">
          <img src={CREATOR_AVATAR_URL} alt="" />
          <span>小民拼豆</span>
        </a>

        <nav aria-label="首页导航">
          <a href="#workflow">创作流程</a>
          <a href="#palette-story">MARD 色库</a>
          <a href={CREATOR_HOME_URL} target="_blank" rel="noreferrer">个人主页 <ExternalLink size={12} /></a>
        </nav>

        <button className="landing-nav-action" onClick={onStart}>
          进入工作台 <ArrowRight size={17} />
        </button>
      </header>

      <main id="top">
        <section className="landing-hero" aria-labelledby="landing-title">
          <BeadHeroCanvas />
          <span className="hero-edition" aria-hidden="true">PATTERN / 001</span>
          <div className="landing-hero-content">
            <span className="landing-kicker">
              <span className="kicker-beads" aria-hidden="true"><i /><i /><i /></span>
              拼豆图纸设计器
            </span>
            <h1 id="landing-title">小民拼豆</h1>
            <p className="landing-tagline">把灵感，一颗颗拼出来。</p>
            <p className="landing-summary">
              从照片到标准色号网格，保留主体、整理色块，再把每一种颜色变成真正可以动手制作的拼豆图纸。
            </p>
            <div className="landing-actions">
              <button className="landing-primary" onClick={onStart}>
                开始设计 <ArrowRight size={18} />
              </button>
              <a className="landing-secondary" href="#workflow">看看能做什么</a>
            </div>
            <div className="landing-trust" aria-label="产品特点">
              <span><ShieldCheck size={16} /> 图片本机处理</span>
              <span><Palette size={16} /> 9 套主流色库</span>
              <span><Download size={16} /> 图纸与工程导出</span>
            </div>
          </div>
        </section>

        <section className="landing-bead-marquee" aria-label="MARD 示例色号">
          <div className="bead-marquee-track">
            {[...featuredPalette, ...featuredPalette].map((color, index) => (
              <span key={`${color.code}-${index}`}>
                <i style={{ background: color.hex }} /> {color.code}
              </span>
            ))}
          </div>
        </section>

        <section className="landing-workflow" id="workflow" data-reveal>
          <div className="landing-section-heading" data-reveal>
            <span>从图片到图纸</span>
            <h2>让复杂图片，落成清楚的每一颗豆</h2>
          </div>

          <div className="landing-steps">
            <article data-reveal>
              <span className="step-number">01</span>
              <ImagePlus size={22} />
              <h3>图片取样</h3>
              <p>尺寸、比例与颜色数量都由作品决定。</p>
            </article>
            <article data-reveal>
              <span className="step-number">02</span>
              <ScanSearch size={22} />
              <h3>主体整理</h3>
              <p>提取人物或物品，并用指定色号衔接分离区域。</p>
            </article>
            <article data-reveal>
              <span className="step-number">03</span>
              <SlidersHorizontal size={22} />
              <h3>落色修图</h3>
              <p>对照品牌色号逐格调整，查看用量并导出图纸。</p>
            </article>
          </div>
        </section>

        <section className="landing-palette-story" id="palette-story" data-reveal>
          <div className="palette-story-copy" data-reveal>
            <span>9 套品牌参考色库</span>
            <h2>屏幕上的颜色，最后要落到手里的豆。</h2>
            <p>每个网格都保留对应色号，颜色、用量和位置一起成为制作依据。</p>
            <button onClick={onStart}>打开色板 <ArrowRight size={17} /></button>
          </div>
          <div className="landing-color-run" aria-label="MARD 示例色号" data-reveal>
            {featuredPalette.map((color, index) => (
              <span key={color.code} style={{ background: color.hex }} className={index === 4 ? 'featured' : ''}>
                <i>{color.code}</i>
              </span>
            ))}
          </div>
        </section>

        <section className="landing-final" data-reveal>
          <span>下一张图，从这里开始。</span>
          <h2>打开画布，做一张属于你的小民拼豆作品。</h2>
          <button className="landing-primary" onClick={onStart}>
            开始设计 <ArrowRight size={18} />
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-brand compact" href={CREATOR_HOME_URL} target="_blank" rel="noreferrer">
          <img src={CREATOR_AVATAR_URL} alt="" />
          <span>{CREATOR_NAME}</span>
          <ExternalLink size={13} />
        </a>
        <span>小民拼豆图纸设计器</span>
        <span>图片仅在当前浏览器处理</span>
      </footer>
    </div>
  )
}
