import combine from "../../Core/combine.js";
import defaultValue from "../../Core/defaultValue.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import FeatureStageFS from "../../Shaders/ModelExperimental/FeatureStageFS.js";
import FeatureStageVS from "../../Shaders/ModelExperimental/FeatureStageVS.js";
import FeatureStageCommon from "../../Shaders/ModelExperimental/FeatureStageCommon.js";

/**
 * The feature pipeline stage is responsible for handling features in the model.
 *
 * @namespace FeaturePipelineStage
 * @private
 */
var FeaturePipelineStage = {};

/**
 * Process a primitive. This modifies the following parts of the render resources.
 * <ul>
 *  <li>sets the defines for the feature ID attribute or texture coordinates to use for feature picking</li>
 *  <li>adds uniforms for the batch texture</li>
 *  <li>sets up varying for the feature coordinates</li>
 *  <li>adds vertex shader code for computing feature coordinates</li>
 * </ul>
 *
 * @param {PrimitiveRenderResources} renderResources The render resources for this primitive.
 * @param {ModelComponents.Primitive} primitive The primitive.
 * @param {FrameState} frameState The frame state.
 */
FeaturePipelineStage.process = function (
  renderResources,
  primitive,
  frameState
) {
  var shaderBuilder = renderResources.shaderBuilder;
  var uniformMap = renderResources.uniformMap;

  shaderBuilder.addDefine("HAS_FEATURES", undefined, ShaderDestination.BOTH);

  // Handle feature attribution: through feature ID texture or feature ID vertex attribute.
  var featureIdTextures = primitive.featureIdTextures;
  if (featureIdTextures.length > 0) {
    var featureIdIndex = 0;
    // Currently, only one feature ID texture is supported.
    var featureIdTexture = featureIdTextures[featureIdIndex];
    var featureIdTextureReader = featureIdTexture.textureReader;

    var featureIdTextureUniformName = "u_featureIdTexture_" + featureIdIndex;
    shaderBuilder.addDefine(
      "FEATURE_ID_TEXTURE",
      featureIdTextureUniformName,
      ShaderDestination.BOTH
    );
    shaderBuilder.addUniform(
      "sampler2D",
      featureIdTextureUniformName,
      ShaderDestination.BOTH
    );
    uniformMap[featureIdTextureUniformName] = function () {
      return defaultValue(
        featureIdTextureReader.texture,
        frameState.context.defaultTexture
      );
    };

    shaderBuilder.addDefine(
      "FEATURE_ID_TEXCOORD",
      "a_texCoord_" + featureIdTextureReader.texCoord,
      ShaderDestination.VERTEX
    );
    shaderBuilder.addDefine(
      "FEATURE_ID_TEXCOORD",
      "v_texCoord_" + featureIdTextureReader.texCoord,
      ShaderDestination.FRAGMENT
    );

    shaderBuilder.addDefine(
      "FEATURE_ID_CHANNEL",
      featureIdTextureReader.channels,
      ShaderDestination.BOTH
    );
  } else {
    shaderBuilder.addDefine(
      "FEATURE_ID_ATTRIBUTE",
      "a_featureId_0",
      ShaderDestination.VERTEX
    );
    shaderBuilder.addVarying("float", "model_featureId");
    shaderBuilder.addVarying("vec2", "model_featureSt");
    shaderBuilder.addVertexLines([FeatureStageCommon]);
    shaderBuilder.addVertexLines([FeatureStageVS]);
  }

  shaderBuilder.addFragmentLines([FeatureStageCommon]);
  shaderBuilder.addFragmentLines([FeatureStageFS]);

  var featureTable = renderResources.model.featureTable;
  // Handle the batch texture.
  var featuresLength = featureTable._featuresLength;
  shaderBuilder.addUniform(
    "float",
    "model_featuresLength",
    ShaderDestination.BOTH
  );
  var batchTexture = renderResources.model.featureTable.batchTexture;
  shaderBuilder.addUniform(
    "sampler2D",
    "model_batchTexture",
    ShaderDestination.VERTEX
  );
  shaderBuilder.addUniform("vec4", "model_textureStep");

  var batchTextureUniforms = {
    model_batchTexture: function () {
      return defaultValue(
        batchTexture.batchTexture,
        batchTexture.defaultTexture
      );
    },
    model_textureStep: function () {
      return batchTexture.textureStep;
    },
    model_featuresLength: function () {
      return featuresLength;
    },
  };
  if (batchTexture.textureDimensions.y > 1) {
    shaderBuilder.addDefine("MULTILINE_BATCH_TEXTURE");
    shaderBuilder.addUniform("vec2", "model_textureDimensions");
    batchTextureUniforms.model_textureDimensions = function () {
      return batchTexture.textureDimensions;
    };
  }

  shaderBuilder.addVarying("vec2", "model_featureSt");
  shaderBuilder.addVarying("vec4", "model_featureColor");

  renderResources.uniformMap = combine(
    batchTextureUniforms,
    renderResources.uniformMap
  );
};

export default FeaturePipelineStage;
