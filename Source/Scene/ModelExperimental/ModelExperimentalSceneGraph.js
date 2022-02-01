import buildDrawCommands from "./buildDrawCommands.js";
import BoundingSphere from "../../Core/BoundingSphere.js";
import Check from "../../Core/Check.js";
import defaultValue from "../../Core/defaultValue.js";
import defined from "../../Core/defined.js";
import Matrix4 from "../../Core/Matrix4.js";
import ModelColorPipelineStage from "./ModelColorPipelineStage.js";
import ModelExperimentalPrimitive from "./ModelExperimentalPrimitive.js";
import ModelExperimentalNode from "./ModelExperimentalNode.js";
import ModelExperimentalUtility from "./ModelExperimentalUtility.js";
import ModelRenderResources from "./ModelRenderResources.js";
import NodeRenderResources from "./NodeRenderResources.js";
import PrimitiveRenderResources from "./PrimitiveRenderResources.js";

/**
 * An in memory representation of the scene graph for a {@link ModelExperimental}
 *
 * @param {Object} options An object containing the following options
 * @param {ModelExperimental} options.model The model this scene graph belongs to
 * @param {ModelComponents} options.modelComponents The model components describing the model
 *
 * @alias ModelExperimentalSceneGraph
 * @constructor
 *
 * @private
 */
export default function ModelExperimentalSceneGraph(options) {
  options = defaultValue(options, defaultValue.EMPTY_OBJECT);
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.model", options.model);
  Check.typeOf.object("options.modelComponents", options.modelComponents);
  //>>includeEnd('debug');

  /**
   * A reference to the {@link ModelExperimental} that owns this scene graph.
   *
   * @type {ModelExperimental}
   * @readonly
   *
   * @private
   */
  this._model = options.model;

  /**
   * The model components that represent the contents of the 3D model file.
   *
   * @type {ModelComponents}
   * @readonly
   *
   * @private
   */
  this._modelComponents = options.modelComponents;

  /**
   * Pipeline stages to apply across the model.
   *
   * @type {Object[]}
   * @readonly
   *
   * @private
   */
  this._pipelineStages = [];

  /**
   * Update stages to across the model.
   */
  this._updateStages = [];

  /**
   * The runtime nodes that make up the scene graph
   *
   * @type {ModelExperimentalNode[]}
   * @readonly
   *
   * @private
   */
  this._runtimeNodes = [];

  /**
   * The indices of the root nodes in the runtime nodes array.
   *
   * @type {Number[]}
   * @readonly
   *
   * @private
   */
  this._rootNodes = [];

  /**
   * Once computed, the {@link DrawCommand}s that are used to render this
   * scene graph are stored here.
   *
   * @type {DrawCommand[]}
   * @readonly
   *
   * @private
   */
  this._drawCommands = [];

  /**
   * The array of bounding spheres of all the primitives in the scene graph.
   *
   * @type {BoundingSphere[]}
   * @readonly
   *
   * @private
   */
  this._boundingSpheres = [];

  /**
   * Pipeline stages to apply to this model. This
   * is an array of classes, each with a static method called
   * <code>process()</code>
   *
   * @type {Object[]}
   * @readonly
   *
   * @private
   */
  this.modelPipelineStages = [];

  this._boundingSphere = undefined;
  this._computedModelMatrix = Matrix4.clone(this._model.modelMatrix);

  initialize(this);
}

Object.defineProperties(ModelExperimentalSceneGraph.prototype, {
  /**
   * The model components this scene graph represents.
   *
   * @type {ModelComponents}
   * @readonly
   *
   * @private
   */
  components: {
    get: function () {
      return this._modelComponents;
    },
  },

  /**
   * The axis-corrected model matrix.
   *
   * @type {Matrix4}
   * @readonly
   *
   * @private
   */
  computedModelMatrix: {
    get: function () {
      return this._computedModelMatrix;
    },
  },
  /**
   * The bounding sphere containing all the primitives in the scene graph.
   *
   * @type {BoundingSphere}
   * @readonly
   *
   * @private
   */
  boundingSphere: {
    get: function () {
      return this._boundingSphere;
    },
  },
});

function initialize(sceneGraph) {
  var components = sceneGraph._modelComponents;
  var scene = components.scene;
  var model = sceneGraph._model;

  sceneGraph._computedModelMatrix = Matrix4.multiplyTransformation(
    model.modelMatrix,
    components.transform,
    new Matrix4()
  );

  ModelExperimentalUtility.correctModelMatrix(
    sceneGraph._computedModelMatrix,
    components.upAxis,
    components.forwardAxis
  );

  var rootNodes = scene.nodes;
  for (var i = 0; i < rootNodes.length; i++) {
    var rootNode = scene.nodes[i];
    var rootNodeTransform = ModelExperimentalUtility.getNodeTransform(rootNode);
    var rootNodeIndex = traverseSceneGraph(
      sceneGraph,
      rootNode,
      rootNodeTransform
    );

    sceneGraph._rootNodes.push(rootNodeIndex);
  }
}

/**
 * Recursively traverse through the nodes in the scene graph, using depth-first
 * post-order traversal.
 *
 * @param {ModelSceneGraph} sceneGraph The scene graph
 * @param {ModelComponents.Node} node The current node
 * @param {Matrix4} transform The current computed transform for this node.
 *
 * @returns {Number} The index of this node in the runtimeNodes array.
 *
 * @private
 */
function traverseSceneGraph(sceneGraph, node, transform) {
  // The indices of the children of this node in the runtimeNodes array.
  var childrenIndices = [];

  // Traverse through scene graph.
  var i;
  if (defined(node.children)) {
    for (i = 0; i < node.children.length; i++) {
      var childNode = node.children[i];
      var childNodeTransform = Matrix4.multiply(
        transform,
        ModelExperimentalUtility.getNodeTransform(childNode),
        new Matrix4()
      );

      var childIndex = traverseSceneGraph(
        sceneGraph,
        childNode,
        childNodeTransform
      );
      childrenIndices.push(childIndex);
    }
  }

  // Process node and mesh primitives.
  var runtimeNode = new ModelExperimentalNode({
    node: node,
    transform: transform,
    children: childrenIndices,
    sceneGraph: sceneGraph,
  });

  if (defined(node.primitives)) {
    for (i = 0; i < node.primitives.length; i++) {
      runtimeNode.runtimePrimitives.push(
        new ModelExperimentalPrimitive({
          primitive: node.primitives[i],
          node: node,
          model: sceneGraph._model,
        })
      );
    }
  }

  sceneGraph._runtimeNodes.push(runtimeNode);

  // The position of the runtime node in the array.
  return sceneGraph._runtimeNodes.length - 1;
}

/**
 * Generates the draw commands for each primitive in the model.
 *
 * @param {FrameState} frameState The current frame state. This is needed to
 * allocate GPU resources as needed.
 *
 * @private
 */
ModelExperimentalSceneGraph.prototype.buildDrawCommands = function (
  frameState
) {
  var modelRenderResources = new ModelRenderResources(this._model);

  this.configurePipeline();
  var modelPipelineStages = this.modelPipelineStages;

  var model = this.model;
  var i, j, k;
  for (i = 0; i < modelPipelineStages.length; i++) {
    var modelPipelineStage = modelPipelineStages[i];
    modelPipelineStage.process(modelRenderResources, model, frameState);
  }

  for (i = 0; i < this._runtimeNodes.length; i++) {
    var runtimeNode = this._runtimeNodes[i];
    runtimeNode.configurePipeline();
    var nodePipelineStages = runtimeNode.pipelineStages;

    var nodeRenderResources = new NodeRenderResources(
      modelRenderResources,
      runtimeNode
    );

    for (j = 0; j < nodePipelineStages.length; j++) {
      var nodePipelineStage = nodePipelineStages[j];

      nodePipelineStage.process(
        nodeRenderResources,
        runtimeNode.node,
        frameState
      );
    }

    for (j = 0; j < runtimeNode.runtimePrimitives.length; j++) {
      var runtimePrimitive = runtimeNode.runtimePrimitives[j];

      runtimePrimitive.configurePipeline();
      var primitivePipelineStages = runtimePrimitive.pipelineStages;

      var primitiveRenderResources = new PrimitiveRenderResources(
        nodeRenderResources,
        runtimePrimitive
      );

      for (k = 0; k < primitivePipelineStages.length; k++) {
        var primitivePipelineStage = primitivePipelineStages[k];

        primitivePipelineStage.process(
          primitiveRenderResources,
          runtimePrimitive.primitive,
          frameState
        );
      }

      runtimePrimitive.boundingSphere = BoundingSphere.clone(
        primitiveRenderResources.boundingSphere
      );
      this._boundingSpheres.push(primitiveRenderResources.boundingSphere);

      var drawCommands = buildDrawCommands(
        primitiveRenderResources,
        frameState
      );

      runtimePrimitive.drawCommands = drawCommands;
    }
  }
  this._boundingSphere = BoundingSphere.fromBoundingSpheres(
    this._boundingSpheres
  );
};

/**
 * Configure the model pipeline stages. If the pipeline needs to be re-run, call
 * this method again to ensure the correct sequence of pipeline stages are
 * used.
 *
 * @private
 */
ModelExperimentalSceneGraph.prototype.configurePipeline = function () {
  var modelPipelineStages = this.modelPipelineStages;
  modelPipelineStages.length = 0;

  var model = this._model;
  if (defined(model.color)) {
    modelPipelineStages.push(ModelColorPipelineStage);
  }
};

ModelExperimentalSceneGraph.prototype.update = function (frameState) {
  var i, j, k;

  for (i = 0; i < this._runtimeNodes.length; i++) {
    var runtimeNode = this._runtimeNodes[i];

    for (j = 0; j < runtimeNode.updateStages.length; j++) {
      var nodeUpdateStage = runtimeNode.updateStages[j];
      nodeUpdateStage.update(runtimeNode, this, frameState);
    }

    for (j = 0; j < runtimeNode.runtimePrimitives.length; j++) {
      var runtimePrimitive = runtimeNode.runtimePrimitives[j];
      for (k = 0; k < runtimePrimitive.updateStages.length; k++) {
        var stage = runtimePrimitive.updateStages[k];
        stage.update(runtimePrimitive);
      }
    }
  }
};

ModelExperimentalSceneGraph.prototype.updateModelMatrix = function () {
  this._computedModelMatrix = Matrix4.clone(this._model.modelMatrix);
  Matrix4.multiply(
    this._computedModelMatrix,
    this._modelComponents.transform,
    this._computedModelMatrix
  );

  ModelExperimentalUtility.correctModelMatrix(
    this._computedModelMatrix,
    this._modelComponents.upAxis,
    this._modelComponents.forwardAxis
  );

  var rootNodes = this._rootNodes;
  for (var i = 0; i < rootNodes.length; i++) {
    var node = this._runtimeNodes[rootNodes[i]];
    node.updateModelMatrix();
  }
};

/**
 * Returns an array of draw commands, obtained by traversing through the scene graph and collecting
 * the draw commands associated with each primitive.
 *
 * @private
 */
ModelExperimentalSceneGraph.prototype.getDrawCommands = function () {
  var drawCommands = [];
  for (var i = 0; i < this._runtimeNodes.length; i++) {
    var runtimeNode = this._runtimeNodes[i];
    for (var j = 0; j < runtimeNode.runtimePrimitives.length; j++) {
      var runtimePrimitive = runtimeNode.runtimePrimitives[j];
      drawCommands.push.apply(drawCommands, runtimePrimitive.drawCommands);
    }
  }
  return drawCommands;
};
