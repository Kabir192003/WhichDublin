import React from 'react'
import { report } from '../domain/monitor.js'

/** A rendering bug in one page shows a way out instead of a blank screen. */
export default class ErrorBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error, info) { report(error, { stack: info?.componentStack }) }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="notice" role="alert">
        <p><b>This page hit a problem.</b> Your saved areas are safe.</p>
        <p><button className="btn sm" onClick={() => location.reload()}>Reload</button> <a className="btn ghost sm" href="#/">Go to start</a></p>
      </div>
    )
  }
}
