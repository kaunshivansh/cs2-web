import struct
import json

glb_path = "/Users/shivanshtiwari/Desktop/cs2/public/assets/models/city.glb"

with open(glb_path, 'rb') as f:
    magic, version, length = struct.unpack('<III', f.read(12))
    chunk_length, chunk_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(chunk_length)
    gltf_json = json.loads(json_bytes.decode('utf-8'))
    
    nodes = gltf_json.get('nodes', [])
    
    # Let's inspect Sphere.001 (Node 8) and Plane.001 (Node 134) / Plane.006 (Node 138)
    target_nodes = [3, 4, 8, 134, 135, 136, 137, 138, 139]
    
    for node_idx in target_nodes:
        if node_idx < len(nodes):
            node = nodes[node_idx]
            print(f"Node {node_idx}: '{node.get('name')}'")
            print(f"  translation: {node.get('translation')}")
            print(f"  rotation: {node.get('rotation')}")
            print(f"  scale: {node.get('scale')}")
            print(f"  mesh index: {node.get('mesh')}")
