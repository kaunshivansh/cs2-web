import struct
import json
import sys
import os

glb_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "../public/assets/models/city.glb")

with open(glb_path, 'rb') as f:
    # Read GLB header: magic (4 bytes), version (4 bytes), length (4 bytes)
    magic, version, length = struct.unpack('<III', f.read(12))
    if magic != 0x46546C67:
        print("Not a valid GLB file")
        exit(1)
        
    # Read first chunk header: chunkLength (4 bytes), chunkType (4 bytes)
    chunk_length, chunk_type = struct.unpack('<II', f.read(8))
    if chunk_type != 0x4E4F534A: # JSON chunk type
        print("First chunk is not JSON")
        exit(1)
        
    # Read JSON content
    json_bytes = f.read(chunk_length)
    gltf_json = json.loads(json_bytes.decode('utf-8'))
    
    print("MESHES:")
    if 'meshes' in gltf_json:
        for idx, mesh in enumerate(gltf_json['meshes']):
            print(f"Mesh {idx}: name='{mesh.get('name', 'unnamed')}'")
    else:
        print("No meshes key found in GLTF")
        
    print("\nNODES:")
    if 'nodes' in gltf_json:
        for idx, node in enumerate(gltf_json['nodes']):
            if 'mesh' in node or 'name' in node:
                print(f"Node {idx}: name='{node.get('name', '')}', mesh={node.get('mesh', None)}")
