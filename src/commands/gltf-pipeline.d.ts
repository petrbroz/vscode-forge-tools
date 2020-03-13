declare module 'gltf-pipeline' {
    export interface IGltfOptions {
        /** The path for reading separate resources. */
        resourceDirectory?: string;
        /** The name of the glTF asset, for writing separate resources. */
        name?: string;
        /** Write separate buffers, shaders, and textures instead of embedding them in the glTF. */
        separate?: boolean;
        /** Write out separate textures only. */
        separateTextures?: boolean;
        /** Print statistics to console for input and output glTF files. */
        stats?: boolean;
        /** Options to pass to the compressDracoMeshes stage. If undefined, stage is not run. */
        dracoOptions?: any;
    }

    export interface IGltfOutput {
        glb: any;
        separateResources?: any;
    }

    export function gltfToGlb(gltf: any, options?: IGltfOptions): Promise<IGltfOutput>;
}
