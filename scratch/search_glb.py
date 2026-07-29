import struct
import json

glb_path = "/Users/shivanshtiwari/Desktop/cs2/public/assets/models/city.glb"

with open(glb_path, 'rb') as f:
    magic, version, length = struct.unpack('<III', f.read(12))
    chunk_length, chunk_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(chunk_length)
    gltf_json = json.loads(json_bytes.decode('utf-8'))
    
    keywords = ['sky', 'dome', 'env', 'plane', 'ground', 'road', 'terrain', 'world', 'base', 'street', 'floor']
    
    print("MATCHING NODES:")
    if 'nodes' in gltf_json:
        for idx, node in enumerate(gltf_json['nodes']):
            name = node.get('name', '').lower()
            if any(kw in name for kw in keywords):
                print(f"Node {idx}: name='{node.get('name')}', mesh={node.get('mesh')}")
