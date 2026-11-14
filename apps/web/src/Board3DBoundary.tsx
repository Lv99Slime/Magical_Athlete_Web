import { Component, type ReactNode } from "react";

interface Props {
  /** Shown instead of the 3D board if it fails, normally the 2D board. */
  fallback: ReactNode;
  /** Short explanation shown above the fallback after a failure. */
  notice?: ReactNode;
  children: ReactNode;
}

/** A broken WebGL context must never cost the players their board. */
export class Board3DBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <>
        {this.props.notice}
        {this.props.fallback}
      </>
    );
  }
}
