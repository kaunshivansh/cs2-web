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
    
    building_keywords = ['casa', 'pizzeria', 'police', 'shop', 'vetro', 'tenda']
    
    print("BUILDING SIZES:")
    for idx, mesh in enumerate(meshes):
        name = mesh.get('name', 'unnamed').lower()
        if any(kw in name for kw in building_keywords):
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
                if min_val and max_val:
                    dx = max_val[0] - min_val[0]
                    dy = max_val[1] - min_val[1]
                    dz = max_val[2] - min_val[2]
                    print(f"Mesh {idx}: '{mesh.get('name')}' size=({dx:.2f}, {dy:.2f}, {dz:.2f})")
