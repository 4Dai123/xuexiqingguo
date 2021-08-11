import defined from "../../Core/defined.js";
import DrawCommand from "../../Renderer/DrawCommand.js";
import Pass from "../../Renderer/Pass.js";
import VertexArray from "../../Renderer/VertexArray.js";
import RenderState from "../../Renderer/RenderState.js";
import ModelExperimentalFS from "../../Shaders/ModelExperimental/ModelExperimentalFS.js";
import ModelExperimentalVS from "../../Shaders/ModelExperimental/ModelExperimentalVS.js";

/**
 * Builds a DrawCommand for a {@link ModelExperimentalSceneMeshPrimitive} using its render resources.
 *
 * @param {RenderResources.MeshRenderResources} meshPrimitiveRenderResources The render resources for a primitive.
 * @param {FrameState} frameState The frame state for creating GPU resources.
 * @returns {DrawCommand} The generated DrawCommand.
 *
 * @private
 */
export default function buildDrawCommand(
  meshPrimitiveRenderResources,
  frameState
) {
  var shaderBuilder = meshPrimitiveRenderResources.shaderBuilder;
  shaderBuilder.addVertexLines([ModelExperimentalVS]);
  shaderBuilder.addFragmentLines([ModelExperimentalFS]);

  var indexBuffer = defined(meshPrimitiveRenderResources.indices)
    ? meshPrimitiveRenderResources.indices.buffer
    : undefined;

  var vertexArray = new VertexArray({
    context: frameState.context,
    indexBuffer: indexBuffer,
    attributes: meshPrimitiveRenderResources.attributes,
  });

  var renderState = RenderState.fromCache(
    meshPrimitiveRenderResources.renderStateOptions
  );

  var shaderProgram = shaderBuilder.buildShaderProgram(frameState.context);
  return new DrawCommand({
    boundingVolume: meshPrimitiveRenderResources.boundingSphere,
    modelMatrix: meshPrimitiveRenderResources.modelMatrix,
    uniformMap: meshPrimitiveRenderResources.uniformMap,
    renderState: renderState,
    vertexArray: vertexArray,
    shaderProgram: shaderProgram,
    cull: meshPrimitiveRenderResources.cull,
    pass: Pass.OPAQUE,
    count: meshPrimitiveRenderResources.count,
    pickId: undefined,
    instanceCount: meshPrimitiveRenderResources.instanceCount,
    primitiveType: meshPrimitiveRenderResources.primitiveType,
  });
}
