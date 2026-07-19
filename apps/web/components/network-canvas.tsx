"use client";

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import gsap from "gsap";
import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import { useEffect, useRef } from "react";
import { formatPosition, formatStable } from "@/lib/format";
import {
  referenceObligations,
  referenceParticipants,
} from "@/lib/reference";
import { useInterfaceStore } from "@/store/interface-store";

interface CanvasNode extends SimulationNodeDatum {
  id: string;
  label: string;
  position: bigint;
  role: string;
}

interface CanvasLink extends SimulationLinkDatum<CanvasNode> {
  id: string;
  source: string | CanvasNode;
  target: string | CanvasNode;
  amount: bigint;
}

interface Point {
  x: number;
  y: number;
}

interface RoutedPath {
  start: Point;
  control: Point;
  end: Point;
}

interface Bounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface LabelView {
  container: Container;
  background: Graphics;
  text: Text;
}

const colors = {
  ink: 0x111317,
  paper: 0xf4f7f1,
  surface: 0xffffff,
  cobalt: 0x124fe5,
  cobaltSoft: 0xdbe6ff,
  acid: 0xb6ff2e,
  magenta: 0xd82878,
  magentaSoft: 0xffe0ed,
  line: 0xd5dbd2,
  lineStrong: 0xaeb7ad,
  muted: 0x666d67,
};

const curveDirection: Record<string, number> = {
  "1": 1,
  "2": -0.55,
  "3": 0.6,
  "4": 0.45,
  "5": -0.45,
  "6": 1,
};

const residuals = [
  { id: "B", amount: 25_000_000n, curve: 0.35 },
  { id: "D", amount: 10_000_000n, curve: -0.32 },
] as const;

function sourceNode(link: CanvasLink): CanvasNode {
  return link.source as CanvasNode;
}

function targetNode(link: CanvasLink): CanvasNode {
  return link.target as CanvasNode;
}

function pointOnQuadratic(path: RoutedPath, amount: number): Point {
  const inverse = 1 - amount;
  return {
    x:
      inverse * inverse * path.start.x +
      2 * inverse * amount * path.control.x +
      amount * amount * path.end.x,
    y:
      inverse * inverse * path.start.y +
      2 * inverse * amount * path.control.y +
      amount * amount * path.end.y,
  };
}

function quadraticNormal(path: RoutedPath, amount: number): Point {
  const dx =
    2 * (1 - amount) * (path.control.x - path.start.x) +
    2 * amount * (path.end.x - path.control.x);
  const dy =
    2 * (1 - amount) * (path.control.y - path.start.y) +
    2 * amount * (path.end.y - path.control.y);
  const length = Math.max(Math.hypot(dx, dy), 1);
  return { x: -dy / length, y: dx / length };
}

function expandBounds(bounds: Bounds, amount: number): Bounds {
  return {
    bottom: bounds.bottom + amount,
    left: bounds.left - amount,
    right: bounds.right + amount,
    top: bounds.top - amount,
  };
}

function overlapArea(first: Bounds, second: Bounds): number {
  const width =
    Math.min(first.right, second.right) - Math.max(first.left, second.left);
  const height =
    Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
  return Math.max(width, 0) * Math.max(height, 0);
}

function nodeExclusionBounds(node: CanvasNode): Bounds[] {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  return [
    { left: x - 52, right: x + 52, top: y - 50, bottom: y + 50 },
    { left: x - 76, right: x + 76, top: y - 88, bottom: y - 43 },
    { left: x - 62, right: x + 62, top: y + 37, bottom: y + 67 },
  ];
}

function edgeExclusionBounds(
  nodes: CanvasNode[],
  sourceId: string,
  targetId: string,
): Bounds[] {
  return nodes.flatMap((node) => {
    const bounds = nodeExclusionBounds(node);
    return node.id === sourceId || node.id === targetId
      ? bounds.slice(1)
      : bounds;
  });
}

function pathObstacleScore(path: RoutedPath, obstacles: Bounds[]): number {
  let score = 0;
  for (let index = 1; index < 20; index += 1) {
    const point = pointOnQuadratic(path, index / 20);
    for (const obstacle of obstacles) {
      const padded = expandBounds(obstacle, 5);
      if (
        point.x >= padded.left &&
        point.x <= padded.right &&
        point.y >= padded.top &&
        point.y <= padded.bottom
      ) {
        score += 1;
      }
    }
  }
  return score;
}

function routePath(
  from: Point,
  to: Point,
  curve: number,
  nodeRadius: number,
): RoutedPath {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const ux = dx / distance;
  const uy = dy / distance;
  const normalX = -uy;
  const normalY = ux;
  const control = {
    x: (from.x + to.x) / 2 + normalX * curve,
    y: (from.y + to.y) / 2 + normalY * curve,
  };
  const startVectorX = control.x - from.x;
  const startVectorY = control.y - from.y;
  const startLength = Math.max(Math.hypot(startVectorX, startVectorY), 1);
  const endVectorX = to.x - control.x;
  const endVectorY = to.y - control.y;
  const endLength = Math.max(Math.hypot(endVectorX, endVectorY), 1);

  return {
    start: {
      x: from.x + (startVectorX / startLength) * nodeRadius,
      y: from.y + (startVectorY / startLength) * nodeRadius,
    },
    control,
    end: {
      x: to.x - (endVectorX / endLength) * nodeRadius,
      y: to.y - (endVectorY / endLength) * nodeRadius,
    },
  };
}

function routePathAroundNodes(
  from: Point,
  to: Point,
  baseCurve: number,
  nodeRadius: number,
  obstacles: Bounds[],
): RoutedPath {
  const spread = Math.max(nodeRadius * 1.55, 52);
  const curveCandidates = [
    baseCurve,
    baseCurve + spread,
    baseCurve - spread,
    baseCurve + spread * 2,
    baseCurve - spread * 2,
    baseCurve + spread * 3,
    baseCurve - spread * 3,
  ];
  let bestPath = routePath(from, to, baseCurve, nodeRadius);
  let bestScore = Number.POSITIVE_INFINITY;

  for (const curve of curveCandidates) {
    const path = routePath(from, to, curve, nodeRadius);
    const collisionScore = pathObstacleScore(path, obstacles) * 10_000;
    const curvePenalty = Math.abs(curve - baseCurve);
    const score = collisionScore + curvePenalty;
    if (score < bestScore) {
      bestPath = path;
      bestScore = score;
    }
    if (collisionScore === 0 && curvePenalty === 0) break;
  }

  return bestPath;
}

function placePathLabel(
  label: LabelView,
  path: RoutedPath,
  obstacles: Bounds[],
  occupied: Bounds[],
  width: number,
  height: number,
  offsetX = 0,
) {
  const pathAmounts = [0.5, 0.4, 0.6, 0.31, 0.69, 0.23, 0.77];
  const normalOffsets = [0, 18, -18, 34, -34, 50, -50];
  const halfWidth = Math.max(label.container.width / 2, 28) + 4;
  const halfHeight = Math.max(label.container.height / 2, 13) + 4;
  let best = {
    position: pointOnQuadratic(path, 0.5),
    bounds: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    score: Number.POSITIVE_INFINITY,
  };

  for (const amount of pathAmounts) {
    const point = pointOnQuadratic(path, amount);
    const normal = quadraticNormal(path, amount);
    for (const normalOffset of normalOffsets) {
      const x = point.x + normal.x * normalOffset + offsetX;
      const y = point.y + normal.y * normalOffset;
      const bounds = {
        left: x - halfWidth,
        right: x + halfWidth,
        top: y - halfHeight,
        bottom: y + halfHeight,
      };
      const overflow =
        Math.max(8 - bounds.left, 0) +
        Math.max(bounds.right - (width - 8), 0) +
        Math.max(72 - bounds.top, 0) +
        Math.max(bounds.bottom - (height - 8), 0);
      const obstacleOverlap = obstacles.reduce(
        (total, obstacle) =>
          total + overlapArea(bounds, expandBounds(obstacle, 4)),
        0,
      );
      const labelOverlap = occupied.reduce(
        (total, other) => total + overlapArea(bounds, expandBounds(other, 6)),
        0,
      );
      const displacement =
        Math.abs(amount - 0.5) * 35 + Math.abs(normalOffset) * 0.12;
      const score =
        overflow * 100_000 +
        obstacleOverlap * 1_000 +
        labelOverlap * 1_000 +
        displacement;

      if (score < best.score) {
        best = { position: { x, y }, bounds, score };
      }
      if (score === 0) break;
    }
    if (best.score === 0) break;
  }

  label.container.position.set(best.position.x, best.position.y);
  occupied.push(best.bounds);
}

function drawArrow(
  graphics: Graphics,
  path: RoutedPath,
  color: number,
  alpha: number,
  width: number,
) {
  graphics
    .moveTo(path.start.x, path.start.y)
    .quadraticCurveTo(
      path.control.x,
      path.control.y,
      path.end.x,
      path.end.y,
    )
    .stroke({ color, alpha, width });

  const angle = Math.atan2(
    path.end.y - path.control.y,
    path.end.x - path.control.x,
  );
  const size = width > 2 ? 9 : 7;
  graphics
    .poly([
      path.end.x,
      path.end.y,
      path.end.x - Math.cos(angle - 0.5) * size,
      path.end.y - Math.sin(angle - 0.5) * size,
      path.end.x - Math.cos(angle + 0.5) * size,
      path.end.y - Math.sin(angle + 0.5) * size,
    ])
    .fill({ color, alpha });
}

function createLabel(
  text: string,
  fontFamily: string,
  resolution: number,
  accent = colors.lineStrong,
): LabelView {
  const container = new Container();
  const background = new Graphics();
  const textView = new Text({
    text,
    resolution,
    style: new TextStyle({
      fill: colors.ink,
      fontFamily,
      fontSize: 10,
      fontWeight: "600",
    }),
  });
  textView.anchor.set(0.5);
  const width = Math.ceil(textView.width) + 22;
  background
    .roundRect(-width / 2, -13, width, 26, 4)
    .fill({ color: colors.surface, alpha: 0.96 })
    .stroke({ color: accent, alpha: 0.85, width: 1 });
  container.addChild(background, textView);
  return { container, background, text: textView };
}

export function NetworkCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mode = useInterfaceStore((state) => state.networkMode);
  const selectedParticipant = useInterfaceStore(
    (state) => state.selectedParticipant,
  );
  const setSelected = useInterfaceStore(
    (state) => state.setSelectedParticipant,
  );
  const modeRef = useRef(mode);
  const selectedRef = useRef(selectedParticipant);
  const setSelectedRef = useRef(setSelected);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    selectedRef.current = selectedParticipant;
  }, [selectedParticipant]);

  useEffect(() => {
    setSelectedRef.current = setSelected;
  }, [setSelected]);

  useEffect(() => {
    const mountHost = hostRef.current;
    if (!mountHost) return;

    let disposed = false;
    let app: Application | undefined;
    let resizeObserver: ResizeObserver | undefined;
    const animation = { progress: modeRef.current === "folded" ? 1 : 0 };

    async function mount(host: HTMLDivElement) {
      await document.fonts.ready;
      if (disposed) return;

      const css = getComputedStyle(document.body);
      const mono =
        css.getPropertyValue("--font-plex").trim() || '"IBM Plex Mono"';
      const sans =
        css.getPropertyValue("--font-instrument").trim() ||
        '"Instrument Sans"';
      const renderResolution = Math.max(
        1.5,
        Math.min(window.devicePixelRatio, 2),
      );

      const nextApp = new Application();
      await nextApp.init({
        resizeTo: host,
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        resolution: renderResolution,
      });
      if (disposed) {
        nextApp.destroy(true);
        return;
      }
      app = nextApp;

      app.canvas.setAttribute("aria-label", "NETFOLD obligation network graph");
      app.canvas.setAttribute("data-testid", "obligation-canvas");
      host.appendChild(app.canvas);

      const nodes: CanvasNode[] = referenceParticipants.map((participant) => ({
        id: participant.id,
        label: participant.label,
        position: participant.position,
        role: participant.role,
      }));
      const links: CanvasLink[] = referenceObligations.map((obligation) => ({
        id: obligation.id,
        source: obligation.from,
        target: obligation.to,
        amount: obligation.amount,
      }));

      const backdrop = new Graphics();
      const grossLayer = new Graphics();
      const residualLayer = new Graphics();
      const flowLayer = new Container();
      const grossLabels = new Container();
      const residualLabels = new Container();
      const nodeLayer = new Container();
      const hudLayer = new Container();
      app.stage.addChild(
        backdrop,
        grossLayer,
        residualLayer,
        flowLayer,
        grossLabels,
        residualLabels,
        nodeLayer,
        hudLayer,
      );

      const nodeViews = new Map<
        string,
        {
          container: Container;
          selection: Graphics;
          halo: Graphics;
          core: Graphics;
          value: LabelView;
        }
      >();

      for (const node of nodes) {
        const semantic =
          node.position > 0n
            ? colors.cobalt
            : node.position < 0n
              ? colors.magenta
              : colors.ink;
        const soft =
          node.position > 0n
            ? colors.cobaltSoft
            : node.position < 0n
              ? colors.magentaSoft
              : colors.acid;
        const container = new Container();
        container.eventMode = "static";
        container.cursor = "pointer";

        const selection = new Graphics()
          .circle(0, 0, 47)
          .stroke({ color: semantic, alpha: 0.95, width: 1.5 });
        const halo = new Graphics()
          .circle(0, 0, 40)
          .fill({ color: soft, alpha: 0.72 });
        const core = new Graphics()
          .circle(0, 0, 29)
          .fill({ color: semantic })
          .stroke({ color: colors.surface, width: 4 });
        const letter = new Text({
          text: node.id,
          resolution: renderResolution,
          style: new TextStyle({
            fill: colors.surface,
            fontFamily: mono,
            fontSize: 15,
            fontWeight: "700",
          }),
        });
        letter.anchor.set(0.5);
        const name = new Text({
          text: node.label.toUpperCase(),
          resolution: renderResolution,
          style: new TextStyle({
            fill: colors.ink,
            fontFamily: mono,
            fontSize: 10,
            fontWeight: "700",
          }),
        });
        name.anchor.set(0.5, 1);
        name.y = -66;
        const role = new Text({
          text: node.role.toUpperCase(),
          resolution: renderResolution,
          style: new TextStyle({
            fill: colors.muted,
            fontFamily: mono,
            fontSize: 8,
            fontWeight: "600",
          }),
        });
        role.anchor.set(0.5, 1);
        role.y = -51;
        const value = createLabel(
          `${formatPosition(node.position)} USDC`,
          mono,
          renderResolution,
          semantic,
        );
        value.container.y = 51;

        container.addChild(
          selection,
          halo,
          core,
          letter,
          name,
          role,
          value.container,
        );
        nodeLayer.addChild(container);
        nodeViews.set(node.id, {
          container,
          selection,
          halo,
          core,
          value,
        });

        container.on("pointertap", () => {
          selectedRef.current = node.id;
          setSelectedRef.current(node.id);
        });
        container.on("pointerover", () => {
          gsap.to(container.scale, {
            x: 1.045,
            y: 1.045,
            duration: 0.18,
            ease: "power2.out",
            overwrite: true,
          });
        });
        container.on("pointerout", () => {
          gsap.to(container.scale, {
            x: 1,
            y: 1,
            duration: 0.22,
            ease: "power2.out",
            overwrite: true,
          });
        });
      }

      const grossLabelViews = links.map((link) => {
        const label = createLabel(
          `${formatStable(link.amount).replace(" USDC", "")} USDC`,
          mono,
          renderResolution,
        );
        grossLabels.addChild(label.container);
        return label;
      });

      const residualLabelViews = residuals.map((residual) => {
        const label = createLabel(
          `${formatStable(residual.amount).replace(" USDC", "")} USDC`,
          mono,
          renderResolution,
          colors.cobalt,
        );
        residualLabels.addChild(label.container);
        return label;
      });

      const flowDots = residuals.map(() => {
        const dot = new Graphics()
          .circle(0, 0, 4)
          .fill({ color: colors.acid })
          .stroke({ color: colors.ink, width: 1 });
        flowLayer.addChild(dot);
        return dot;
      });

      const hudBackground = new Graphics();
      const hudMetrics = [
        { label: "GROSS / USDC", value: "265.00" },
        { label: "RESIDUAL / USDC", value: "35.00" },
        { label: "SAVED", value: "86.8%" },
      ].map((metric) => {
        const container = new Container();
        const label = new Text({
          text: metric.label,
          resolution: renderResolution,
          style: new TextStyle({
            fill: colors.muted,
            fontFamily: mono,
            fontSize: 8,
            fontWeight: "600",
          }),
        });
        const value = new Text({
          text: metric.value,
          resolution: renderResolution,
          style: new TextStyle({
            fill: colors.ink,
            fontFamily: sans,
            fontSize: 16,
            fontWeight: "700",
          }),
        });
        label.position.set(12, 8);
        value.position.set(12, 22);
        container.addChild(label, value);
        hudLayer.addChild(container);
        return container;
      });
      hudLayer.addChildAt(hudBackground, 0);

      let residualPaths: RoutedPath[] = [];
      let selectedId = selectedRef.current;
      let canvasWidth = 0;
      let canvasHeight = 0;
      let nodeRadius = 39;
      let compactLayout = false;

      function drawBackdrop(width: number, height: number, isCompact: boolean) {
        backdrop.clear();
        backdrop
          .rect(0, 0, width, height)
          .fill({ color: colors.paper });

        const inset = isCompact ? 14 : 20;
        const lowerY = 78;
        backdrop
          .moveTo(inset, lowerY)
          .lineTo(width - inset, lowerY)
          .stroke({ color: colors.line, alpha: 0.72, width: 1 });

        if (!isCompact) {
          const debtorLane = width * 0.31;
          const creditorLane = width * 0.61;
          backdrop
            .rect(0, lowerY, debtorLane, Math.max(0, height - lowerY))
            .fill({ color: colors.magentaSoft, alpha: 0.13 });
          backdrop
            .rect(
              creditorLane,
              lowerY,
              width - creditorLane,
              Math.max(0, height - lowerY),
            )
            .fill({ color: colors.cobaltSoft, alpha: 0.16 });
          backdrop
            .moveTo(debtorLane, lowerY)
            .lineTo(debtorLane, height)
            .stroke({ color: colors.line, alpha: 0.45, width: 1 });
          backdrop
            .moveTo(creditorLane, lowerY)
            .lineTo(creditorLane, height)
            .stroke({ color: colors.line, alpha: 0.45, width: 1 });
        }
      }

      function layoutHud(width: number, isCompact: boolean) {
        const inset = isCompact ? 14 : 20;
        const totalWidth = Math.min(width - inset * 2, isCompact ? width : 430);
        const metricWidth = totalWidth / hudMetrics.length;
        hudLayer.position.set(inset, 10);
        hudBackground.clear();
        hudBackground
          .roundRect(0, 0, totalWidth, 56, 5)
          .fill({ color: colors.surface, alpha: 0.9 })
          .stroke({ color: colors.lineStrong, alpha: 0.7, width: 1 });
        hudMetrics.forEach((metric, index) => {
          metric.position.x = index * metricWidth;
          if (index > 0) {
            hudBackground
              .moveTo(index * metricWidth, 0)
              .lineTo(index * metricWidth, 56)
              .stroke({ color: colors.line, alpha: 0.8, width: 1 });
          }
        });
      }

      function draw() {
        grossLayer.clear();
        residualLayer.clear();

        const grossAlpha = 1 - animation.progress;
        const foldedAlpha = animation.progress;
        const curveUnit = Math.min(canvasWidth, canvasHeight);
        const allNodeObstacles = nodes.flatMap(nodeExclusionBounds);
        const grossLabelBounds: Bounds[] = [];
        const residualLabelBounds: Bounds[] = [];

        links.forEach((link, index) => {
          const source = sourceNode(link);
          const target = targetNode(link);
          const sourcePoint = { x: source.x ?? 0, y: source.y ?? 0 };
          const targetPoint = { x: target.x ?? 0, y: target.y ?? 0 };
          const curve =
            curveUnit * 0.085 * (curveDirection[link.id] ?? 0.45);
          const path = routePathAroundNodes(
            sourcePoint,
            targetPoint,
            curve,
            nodeRadius,
            edgeExclusionBounds(nodes, source.id, target.id),
          );
          drawArrow(
            grossLayer,
            path,
            colors.ink,
            0.46 * grossAlpha,
            1.35,
          );

          const label = grossLabelViews[index];
          if (label) {
            const compactOffsetX =
              compactLayout && link.id === "3"
                ? -42
                : compactLayout && link.id === "5"
                  ? 42
                  : 0;
            placePathLabel(
              label,
              path,
              allNodeObstacles,
              grossLabelBounds,
              canvasWidth,
              canvasHeight,
              compactOffsetX,
            );
            label.container.alpha = grossAlpha;
            label.container.scale.set(0.92 + grossAlpha * 0.08);
          }
        });

        const debtor = nodes.find((node) => node.id === "A");
        residualPaths = [];
        residuals.forEach((residual, index) => {
          const creditor = nodes.find((node) => node.id === residual.id);
          if (!debtor || !creditor) return;
          const path = routePathAroundNodes(
            { x: debtor.x ?? 0, y: debtor.y ?? 0 },
            { x: creditor.x ?? 0, y: creditor.y ?? 0 },
            curveUnit * 0.07 * residual.curve,
            nodeRadius,
            edgeExclusionBounds(nodes, debtor.id, creditor.id),
          );
          residualPaths.push(path);
          drawArrow(
            residualLayer,
            path,
            colors.cobalt,
            foldedAlpha,
            3,
          );
          const label = residualLabelViews[index];
          if (label) {
            placePathLabel(
              label,
              path,
              allNodeObstacles,
              residualLabelBounds,
              canvasWidth,
              canvasHeight,
            );
            label.container.alpha = foldedAlpha;
            label.container.scale.set(0.84 + foldedAlpha * 0.16);
          }
        });

        for (const node of nodes) {
          const view = nodeViews.get(node.id);
          if (!view) continue;
          view.container.position.set(node.x ?? 0, node.y ?? 0);
          view.selection.alpha = node.id === selectedId ? 1 : 0;
          view.selection.scale.set(
            node.id === selectedId ? 1 + animation.progress * 0.05 : 0.92,
          );
          view.halo.alpha = 0.64 + animation.progress * 0.2;
          view.value.container.alpha = 0.84 + animation.progress * 0.16;
        }
      }

      function layout() {
        if (!app) return;
        const width = Math.max(host.clientWidth, 320);
        const height = Math.max(host.clientHeight, 360);
        const isCompact = width < 620;
        compactLayout = isCompact;
        canvasWidth = width;
        canvasHeight = height;
        nodeRadius = isCompact ? 35 : 39;
        app.renderer.resize(width, height);
        drawBackdrop(width, height, isCompact);
        layoutHud(width, isCompact);

        const top = 88;
        const usableHeight = Math.max(height - top, 260);
        const anchors: Record<string, Point> = isCompact
          ? {
              A: { x: width * 0.23, y: top + usableHeight * 0.25 },
              B: { x: width * 0.77, y: top + usableHeight * 0.25 },
              C: { x: width * 0.23, y: top + usableHeight * 0.72 },
              D: { x: width * 0.77, y: top + usableHeight * 0.72 },
            }
          : {
              A: { x: width * 0.18, y: top + usableHeight * 0.45 },
              B: { x: width * 0.78, y: top + usableHeight * 0.27 },
              C: { x: width * 0.48, y: top + usableHeight * 0.72 },
              D: { x: width * 0.8, y: top + usableHeight * 0.72 },
            };

        for (const node of nodes) {
          const anchor = anchors[node.id] ?? { x: width / 2, y: height / 2 };
          node.x = anchor.x;
          node.y = anchor.y;
          node.vx = 0;
          node.vy = 0;
        }

        forceSimulation(nodes)
          .force(
            "link",
            forceLink<CanvasNode, CanvasLink>(links)
              .id((node) => node.id)
              .distance(Math.min(width, usableHeight) * 0.42)
              .strength(0.035),
          )
          .force("charge", forceManyBody().strength(isCompact ? -120 : -240))
          .force("collide", forceCollide(isCompact ? 64 : 74).strength(1))
          .force(
            "x",
            forceX<CanvasNode>(
              (node) => anchors[node.id]?.x ?? width / 2,
            ).strength(0.88),
          )
          .force(
            "y",
            forceY<CanvasNode>(
              (node) => anchors[node.id]?.y ?? height / 2,
            ).strength(0.88),
          )
          .stop()
          .tick(180);
        draw();
      }

      layout();
      resizeObserver = new ResizeObserver(layout);
      resizeObserver.observe(host);

      let tweenTarget = animation.progress;
      let flowPhase = 0;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const modeTicker = (ticker: { deltaMS: number }) => {
        const target = modeRef.current === "folded" ? 1 : 0;
        if (target !== tweenTarget) {
          tweenTarget = target;
          if (reduceMotion) {
            animation.progress = target;
            draw();
          } else {
            gsap.to(animation, {
              progress: target,
              duration: 0.68,
              ease: "power3.inOut",
              overwrite: true,
              onUpdate: draw,
            });
          }
        }
        if (selectedRef.current !== selectedId) {
          selectedId = selectedRef.current;
          draw();
        }

        flowPhase = (flowPhase + ticker.deltaMS / 3200) % 1;
        flowDots.forEach((dot, index) => {
          const path = residualPaths[index];
          if (!path) return;
          const point = pointOnQuadratic(path, (flowPhase + index * 0.42) % 1);
          dot.position.set(point.x, point.y);
          dot.alpha = animation.progress;
        });
      };
      app.ticker.add(modeTicker);
    }

    void mount(mountHost);
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      gsap.killTweensOf(animation);
      if (app) {
        app.destroy(true, { children: true });
      }
      mountHost.replaceChildren();
    };
  }, []);

  return <div ref={hostRef} className="network-canvas" />;
}
