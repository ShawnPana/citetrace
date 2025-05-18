import rawSimData from "../../assets/similarity_scores.json";
const simData: Record<string, Record<string, number>> = rawSimData;
import React, { useEffect, useState } from "react";
import {
  View,
  Dimensions,
  Text as RNText,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, Line, G, Text as SvgText, Path } from "react-native-svg";
import { createClient } from "@supabase/supabase-js";
import { polygonHull } from "d3-polygon";

// Supabase client
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SIDEBAR_WIDTH = 300;
const BASE_RADIUS = 26;
const LABEL_OFFSET = 20; // increased to give more gap between node and label

interface Node {
  id: string;
  label: string;
  angle: number;
  radius: number;
  color: string;
  cluster: number;
}
interface Link {
  source: string;
  target: string;
  similarity: number;
}

export default function KnowledgeGraphScreen() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [theta, setTheta] = useState(0);

  // animate rotation slower
  useEffect(() => {
    let raf: number;
    const loop = () => {
      setTheta((t) => t + 0.0005);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // fetch nodes and build links
  useEffect(() => {
    async function fetchPapers() {
      const { data: files, error } = await supabase.storage.from("pdfs").list("", { limit: 100 });
      if (error) return console.error(error.message);

      const paperNodes: Node[] = files.map((f) => ({
        id: f.name,
        label: f.name.replace(/\.pdf$/, ""),
        angle: 0,
        radius: 0,
        color: "#888",
        cluster: 0,
      }));

      // build links from similarity data
      const paperLinks: Link[] = [];
      paperNodes.forEach((a) => {
        paperNodes.forEach((b) => {
          if (a.id < b.id) {
            const fwd = simData[a.id]?.[b.id];
            const rev = simData[b.id]?.[a.id];
            const s = fwd !== undefined ? fwd : rev;
            if (s !== undefined) paperLinks.push({ source: a.id, target: b.id, similarity: s });
          }
        });
      });

      // similarity range for coloring
      const sims = paperLinks.map((l) => l.similarity);
      const minSim = Math.min(...sims);
      const maxSim = Math.max(...sims);

      // clustering for hulls only
      const threshold = 0.6;
      const parent = new Map<string, string>();
      paperNodes.forEach((n) => parent.set(n.id, n.id));
      function find(u: string): string {
        const p = parent.get(u)!;
        if (p !== u) {
          const r = find(p);
          parent.set(u, r);
          return r;
        }
        return u;
      }
      function union(u: string, v: string) {
        const pu = find(u), pv = find(v);
        if (pu !== pv) parent.set(pu, pv);
      }
      paperLinks.forEach((l) => { if (l.similarity >= threshold) union(l.source, l.target); });
      const clusters = new Map<string, Node[]>();
      paperNodes.forEach((n) => {
        const root = find(n.id);
        if (!clusters.has(root)) clusters.set(root, []);
        clusters.get(root)!.push(n);
      });
      const clusterArr = Array.from(clusters.values());

      // distribute nodes in full circle with more compact radius
      const windowDims = Dimensions.get("window");
      const baseR = Math.min(windowDims.width, windowDims.height) / 2 - BASE_RADIUS * 2;
      const R = baseR * 0.6; // loosened cluster radius for more spread // tighter cluster radius to keep nodes on-screen // tightened cluster radius for less spread // increased base radius for wider spread // increase base radius for more spread
      paperNodes.forEach((node) => {
        node.angle = Math.random() * 2 * Math.PI;
        node.radius = R + (Math.random() - 0.5) * baseR * 0.3; // increased jitter for better spacing // reduced jitter for compact grouping // reduced jitter for compact layout // increased jitter for greater spacing // increase jitter for more spread
        // average similarity for color
        const related = paperLinks.filter((l) => l.source === node.id || l.target === node.id);
        const avg = related.reduce((sum, l) => sum + l.similarity, 0) / related.length;
        const t = (avg - minSim) / (maxSim - minSim);
        // map t to hue (240 blue to 0 red)
        const hue = 240 - t * 240;
        node.color = `hsl(${hue},70%,60%)`;
      });

      setNodes(paperNodes);
      setLinks(paperLinks);
    }
    fetchPapers();
  }, []);

  const windowDims = Dimensions.get("window");
  const W = windowDims.width;
  const H = windowDims.height;
  const cx = W / 2;
  const cy = H / 2;

  // compute positions; text stays directly below node
  const positioned = nodes.map((n) => {
    const x = cx + n.radius * Math.cos(n.angle + theta);
    const y = cy + n.radius * Math.sin(n.angle + theta);
    return { ...n, x, y };
  });

  // cluster hulls
  const hulls = Array.from(
    positioned.reduce((m, n) => {
      if (!m.has(n.cluster)) m.set(n.cluster, []);
      m.get(n.cluster)!.push([n.x, n.y]);
      return m;
    }, new Map<number, [number, number][]>())
  ).map(([, pts]) => polygonHull(pts));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <RNText style={styles.headerTitle}>Knowledge Graph Explorer</RNText>
      </View>
      <View style={styles.body}>
        <View style={[styles.graphWrapper, { width: selected ? W - SIDEBAR_WIDTH : W }]}>        
          <Svg width={selected ? W - SIDEBAR_WIDTH : W} height={H - 100}>
            {/* cluster regions */}
            {hulls.map(
              (hull, idx) =>
                hull && (
                  <Path
                    key={idx}
                    d={hull.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ') + ' Z'}
                    fill={positioned.find((n) => n.cluster === idx)?.color}
                    opacity={0.15}
                    stroke={positioned.find((n) => n.cluster === idx)?.color}
                    strokeWidth={2}
                  />
                )
            )}
            {/* links */}
            {links.map((l, idx) => {
              const s = positioned.find((n) => n.id === l.source);
              const t = positioned.find((n) => n.id === l.target);
              if (!s || !t) return null;
              return (
                <Line
                  key={idx}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke="#ccc"
                  strokeOpacity={0.1 + l.similarity * 0.9}
                  strokeWidth={1}
                />
              );
            })}
            {/* nodes and static text */}
            {positioned.map((n) => {
              const isSel = selected?.id === n.id;
              const isHov = hovered === n.id;
              return (
                <G
                  key={n.id}
                  onPress={() => setSelected(n)}
                  onPressIn={() => setHovered(n.id)}
                  onPressOut={() => setHovered(null)}
                >
                  <Circle
                    cx={n.x}
                    cy={n.y}
                    r={isHov ? BASE_RADIUS * 1.2 : BASE_RADIUS}
                    fill={n.color}
                    stroke="#333"
                    strokeWidth={isSel ? 4 : isHov ? 3 : 2}
                    opacity={0.8}
                  />
                  <SvgText
                    x={n.x}
                    y={n.y + BASE_RADIUS + LABEL_OFFSET}
                    fontSize={12}
                    fill="#333"
                    textAnchor="middle"
                  >
                    {n.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
        {selected && (
          <View style={styles.sidebar}>
            <ScrollView contentContainerStyle={styles.sidebarContent}>
              <RNText style={styles.title}>{selected.label}</RNText>
              <View style={styles.notesContainer}>
                <RNText style={styles.section}>Your Notes</RNText>
                <TextInput
                  multiline
                  placeholder="Your notes here!"
                  style={styles.textArea}
                  value={notes[selected.id] || ""}
                  onChangeText={(t) => setNotes((p) => ({ ...p, [selected.id]: t }))}
                />
              </View>
              <Pressable style={styles.close} onPress={() => setSelected(null)}>
                <RNText style={styles.closeText}>Close</RNText>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
  body: { flex: 1, flexDirection: 'row' },
  graphWrapper: { backgroundColor: '#f5f7fa', height: '100%' },
  sidebar: { width: SIDEBAR_WIDTH, backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: '#e0e0e0', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sidebarContent: { paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16, color: '#4a4a4a' },
  notesContainer: { backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, marginBottom: 20 },
  section: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#555' },
  textArea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, minHeight: 100, textAlignVertical: 'top', backgroundColor: '#fff' },
  close: { alignSelf: 'center', backgroundColor: '#4a90e2', borderRadius: 20, paddingHorizontal: 30, paddingVertical: 12, marginTop: 10 },
  closeText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
