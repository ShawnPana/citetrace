import React, { useEffect, useRef, useState } from "react";
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
import Svg, { Circle, Line, G, Text as SvgText } from "react-native-svg";
import * as d3 from "d3-force";

// constants
const SIDEBAR_WIDTH = 300;

// types
interface Node { id: string; label: string; subject: string; color: string; x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null; }
interface Link { source: string | Node; target: string | Node; similarity: number; }

// sample data
const demoNodes: Node[] = [
  { id: "1", label: "HAha", subject: "CV", color: "#ff6b6b" },
  { id: "2", label: "HEHFAHF", subject: "ML", color: "#4ecdc4" },
  { id: "3", label: "HUHH", subject: "AI", color: "#ffe66d" },
  { id: "4", label: "Wack", subject: "ML", color: "#1a535c" },
];
const demoLinks: Link[] = [
  { source: "1", target: "2", similarity: 0.3 },
  { source: "2", target: "4", similarity: 0.7 },
  { source: "1", target: "4", similarity: 0.5 },
  { source: "3", target: "1", similarity: 0.2 },
  { source: "3", target: "4", similarity: 0.4 },
];
const professorsByNode: Record<string, string[]> = { "1":["Fei‑Fei Li","Jitendra Malik"],"2":["Petar Veličković","Yoshua Bengio"],"3":["Richard Sutton","David Silver"],"4":["Ting Chen","Kaiming He"] };
const arxivByNode: Record<string, {title:string;id:string}[]> = { "1":[{title:"Segment Anything",id:"2304.02643"},{title:"Vision Transformers",id:"2010.11929"}],"2":[{title:"Graph Isomorphism Networks",id:"1810.00826"},{title:"GNN Survey",id:"1812.08434"}],"3":[{title:"AlphaGo",id:"1603.03848"},{title:"Deep RL Survey",id:"1810.06339"}],"4":[{title:"SimCLR",id:"2002.05709"},{title:"MoCo",id:"1911.05722"}] };

export default function KnowledgeGraphScreen() {
  const window = Dimensions.get("window");
  const [nodes, setNodes] = useState<Node[]>([...demoNodes]);
  const [links] = useState<Link[]>([...demoLinks]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [graphLeft, setGraphLeft] = useState(0);
  const simRef = useRef<d3.Simulation<Node, undefined> | null>(null);

  useEffect(() => {
    simRef.current = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink<Node, Link>(links as any).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-350))
      .force("center", d3.forceCenter(window.width / 2, window.height / 2))
      .on("tick", () => setNodes([...simRef.current!.nodes()]));
    return () => {
      simRef.current?.stop();
    };
  }, []);

  // helper functions for moving nodes and stuff
  const resolveNode = (n: string | Node): Node => (typeof n === "string" ? (nodes.find(nn => nn.id===n) as Node) : (n as Node));
  const fixNode = (node: Node, pageX: number, pageY: number) => {
    node.fx = pageX - graphLeft; 
    node.fy = pageY; 
  };

  const graphWidth = selected ? window.width - SIDEBAR_WIDTH : window.width;

  const onGraphLayout = (e: LayoutChangeEvent) => {
    setGraphLeft(e.nativeEvent.layout.x);
  };

  return (
    <View style={styles.rowRoot}>
      <View onLayout={onGraphLayout} style={[styles.graphWrapper,{width:graphWidth}]}>        
        <Svg width={graphWidth} height={window.height}>
          {links.map((l,idx)=>{const s=resolveNode(l.source);const t=resolveNode(l.target);if(!s||!t||s.x==null||t.x==null)return null;return <Line key={idx} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#999" strokeOpacity={l.similarity} strokeWidth={2}/>;})}
          {nodes.map(n=>{if(n.x==null||n.y==null)return null;return(<G key={n.id}
                onStartShouldSetResponder={()=>true}
                onMoveShouldSetResponder={()=>true}
                onResponderGrant={e=>{fixNode(n,e.nativeEvent.pageX,e.nativeEvent.pageY);simRef.current?.alpha(0.5).restart();}}
                onResponderMove={e=>{fixNode(n,e.nativeEvent.pageX,e.nativeEvent.pageY);simRef.current?.alpha(0.5).restart();}}
                onResponderRelease={()=>{n.fx=n.fy=null;simRef.current?.alphaTarget(0);}}
                onPress={()=>setSelected(n)}>
              <Circle cx={n.x} cy={n.y} r={26} fill={n.color}/>
              <SvgText x={n.x} y={n.y+38} fontSize={11} fill="#000" textAnchor="middle">{n.label}</SvgText>
            </G>);})}
        </Svg>
      </View>
      {selected&&(<View style={styles.sidebar}><ScrollView contentContainerStyle={styles.sidebarContent}><RNText style={styles.title}>{selected.label}</RNText><RNText style={styles.section}>Your Notes</RNText><TextInput multiline placeholder="Your notes here!" style={styles.textArea} value={notes[selected.id]||""} onChangeText={t=>setNotes(p=>({...p,[selected.id]:t}))}/><RNText style={styles.section}>Prominent Professors</RNText>{professorsByNode[selected.id].map(prof=>(<RNText key={prof} style={styles.list}>• {prof}</RNText>))}<RNText style={styles.section}>Related arXiv Papers</RNText>{arxivByNode[selected.id].map(({title,id})=>(<RNText key={id} style={styles.list}>• {title} ({id})</RNText>))}<Pressable style={styles.close} onPress={()=>setSelected(null)}><RNText style={styles.closeText}>Close</RNText></Pressable></ScrollView></View>)}
    </View>
  );
}

// styles
const styles=StyleSheet.create({rowRoot:{flex:1,flexDirection:"row",backgroundColor:"#fff"},graphWrapper:{height:"100%"},sidebar:{width:SIDEBAR_WIDTH,backgroundColor:"#fff",paddingTop:24,paddingHorizontal:16},sidebarContent:{paddingBottom:40},title:{fontSize:20,fontWeight:"700",marginBottom:12},section:{fontSize:15,fontWeight:"600",marginTop:18,marginBottom:6},textArea:{borderWidth:1,borderColor:"#ccc",borderRadius:12,padding:8,minHeight:80,textAlignVertical:"top"},list:{marginLeft:10,marginVertical:2},close:{alignSelf:"center",backgroundColor:"#1a535c",borderRadius:16,paddingHorizontal:26,paddingVertical:10,marginTop:28},closeText:{color:"#fff",fontWeight:"600"}});
