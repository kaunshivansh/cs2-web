import struct
import json

glb_path = "/Users/shivanshtiwari/Desktop/cs2/public/assets/models/city.glb"

with open(glb_path, 'rb') as f:
    magic, version, length = struct.unpack('<III', f.read(12))
    chunk_length, chunk_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(chunk_length)
    gltf_json = json.loads(json_bytes.decode('utf-8'))
    
    accessors = gltf_json.get('accessors', [])
    meshes = gltf_json.get('meshes', [])
    
    print("MESH BOUNDS:")
    for idx, mesh in enumerate(meshes):
        name = mesh.get('name', 'unnamed')
        # Find POSITION accessor
        pos_accessor_idx = None
        for prim in mesh.get('primitives', []):
            attrs = prim.get('attributes', {})
            if 'POSITION' in attrs:
                pos_accessor_idx = attrs['POSITION']
                break
        
        if pos_accessor_idx is not None and pos_accessor_idx < len(accessors):
            acc = accessors[pos_accessor_idx]
            min_val = acc.get('min', [])
            max_val = acc.get('max', [])
            print(f"Mesh {idx}: '{name}' min={min_val} max={max_val}")
        else:
            print(f"Mesh {idx}: '{name}' (no position accessor)")
