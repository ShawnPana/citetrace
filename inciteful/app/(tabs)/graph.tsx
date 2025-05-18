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
const LABEL_OFFSET = 0; // distance from node edge

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
  const window = Dimensions.get("window");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [graphLeft, setGraphLeft] = useState(0);

  // rotation
  const [theta, setTheta] = useState(0);
  useEffect(() => {
    let raf: number;
    const animate = () => {
      setTheta((t) => t + 0.0005);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // fetch and cluster
  useEffect(() => {
    async function fetchPapers() {
      const { data: files, error } = await supabase.storage
        .from("pdfs")
        .list("", { limit: 100 });
      if (error) {
        console.error(error.message);
        return;
      }
      // create nodes
      const paperNodes = files.map((f) => ({
        id: f.name,
        label: f.name.replace(/\.pdf$/, ""),
        angle: 0,
        radius: 0,
        color: "#888",
        cluster: 0,
      }));
      // create random links
      const paperLinks: Link[] = [];
      paperNodes.forEach((a, i) => {
        for (let j = i + 1; j < paperNodes.length; j++) {
          paperLinks.push({
            source: a.id,
            target: paperNodes[j].id,
            similarity: Math.random(),
          });
        }
      });

      // union-find clustering
      const threshold = 0.6;
      const parent = new Map<string, string>();
      paperNodes.forEach((n) => parent.set(n.id, n.id));
      function find(u: string): string {
        const p = parent.get(u)!;
        if (p !== u) {
          const root = find(p);
          parent.set(u, root);
          return root;
        }
        return u;
      }
      function union(u: string, v: string) {
        const pu = find(u);
        const pv = find(v);
        if (pu !== pv) parent.set(pu, pv);
      }
      paperLinks.forEach((l) => {
        if (l.similarity >= threshold) union(l.source, l.target);
      });

      // group clusters
      const clusters = new Map<string, Node[]>();
      paperNodes.forEach((n) => {
        const root = find(n.id);
        if (!clusters.has(root)) clusters.set(root, []);
        clusters.get(root)!.push(n);
      });
      const clusterArr = Array.from(clusters.values());

      // assign cluster id, angle, radius, color
      const baseR = Math.min(window.width, window.height) / 2 - BASE_RADIUS * 2;
      const R = baseR * 0.6;
      clusterArr.forEach((group, ci) => {
        const sector = (2 * Math.PI) / clusterArr.length;
        const centerAng = sector * ci;
        group.forEach((node) => {
          node.cluster = ci;
          node.angle = centerAng + (Math.random() - 0.5) * (sector * 0.5);
          node.radius = R + (Math.random() - 0.5) * (baseR * 0.15);
          const hue = 200 + (ci / clusterArr.length) * 80; // pastel blues
          node.color = `hsl(${hue},60%,75%)`;
        });
      });

      setNodes(paperNodes);
      setLinks(paperLinks);
    }
    fetchPapers();
  }, []);

  const onGraphLayout = (e: LayoutChangeEvent) => setGraphLeft(e.nativeEvent.layout.x);

  const W = window.width;
  const H = window.height;
  const cx = W / 2;
  const cy = H / 2;

  // compute positions and label offsets to avoid overlap
  const positioned = nodes.map((n) => {
    const x = cx + n.radius * Math.cos(n.angle + theta);
    const y = cy + n.radius * Math.sin(n.angle + theta);
    // radial label position
    const lx = cx + (n.radius + BASE_RADIUS + LABEL_OFFSET) * Math.cos(n.angle + theta);
    const ly = cy + (n.radius + BASE_RADIUS + LABEL_OFFSET) * Math.sin(n.angle + theta);
    return { ...n, x, y, lx, ly };
  });

  // compute hulls for each cluster
  const hulls = Array.from(
    positioned.reduce((map, n) => {
      if (!map.has(n.cluster)) map.set(n.cluster, []);
      map.get(n.cluster)!.push([n.x, n.y]);
      return map;
    }, new Map<number, [number, number][]>())
  ).map(([, pts]) => polygonHull(pts));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <RNText style={styles.headerTitle}>Knowledge Graph Explorer</RNText>
      </View>
      <View style={styles.body}>
        <View onLayout={onGraphLayout} style={[styles.graphWrapper, { width: selected ? W - SIDEBAR_WIDTH : W }]}>        
          <Svg width={selected ? W - SIDEBAR_WIDTH : W} height={H - 100}>
            {/* cluster regions */}
            {hulls.map((hull, idx) =>
              hull ? (
                <Path
                  key={idx}
                  d={
                    hull
                      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`)
                      .join(' ') + ' Z'
                  }
                  fill={positioned.find((n) => n.cluster === idx)?.color}
                  opacity={0.15}
                  stroke={positioned.find((n) => n.cluster === idx)?.color}
                  strokeWidth={1}
                />
              ) : null
            )}
            {/* links */}
            {links.map((l, idx) => {
              const s = positioned.find((n) => n.id === l.source);
              const t = positioned.find((n) => n.id === l.target);
              if (!s || !t) return null;
              return <Line key={idx} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#ccc" strokeOpacity={l.similarity * 0.5} strokeWidth={1}/>;
            })}
            {/* nodes and labels */}
            {positioned.map((n) => {
              const isSelected = selected?.id === n.id;
              const isHovered = hovered === n.id;
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
                    r={isHovered ? BASE_RADIUS * 1.2 : BASE_RADIUS}
                    fill={n.color}
                    stroke={isSelected ? '#4a90e2' : 'transparent'}
                    strokeWidth={isSelected ? 3 : 0}
                  />
                  <SvgText x={n.lx} y={n.ly} fontSize={12} fill="#333" textAnchor="middle">
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
  header: { height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#333333' },
  body: { flex: 1, flexDirection: 'row' },
  graphWrapper: { backgroundColor: '#f5f7fa', height: '100%' },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: '#ffffff',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sidebarContent: { paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16, color: '#4a4a4a' },
  notesContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 20,
  },
  section: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#555555' },
  textArea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, minHeight: 100, textAlignVertical: 'top', backgroundColor: '#ffffff' },
  close: { alignSelf: 'center', backgroundColor: '#4a90e2', borderRadius: 20, paddingHorizontal: 30, paddingVertical: 12, marginTop: 10 },
  closeText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
