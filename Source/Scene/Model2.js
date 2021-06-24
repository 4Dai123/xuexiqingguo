import DrawCommand from "../Renderer/DrawCommand.js";
import Pass from "../Renderer/Pass.js";
import RenderState from "../Renderer/RenderState.js";
import when from "../ThirdParty/when.js";
import BoundingSphere from "../Core/BoundingSphere.js";
import ShaderProgram from "../Renderer/ShaderProgram.js";
import defined from "../Core/defined.js";
import Matrix4 from "../Core/Matrix4.js";
import VertexArray from "../Renderer/VertexArray.js";
import Cartesian3 from "../Core/Cartesian3.js";
import Quaternion from "../Core/Quaternion.js";
import ComponentDatatype from "../Core/ComponentDatatype.js";

export default function Model(options) {
  this.drawCommand = undefined;
  this.loader = options.loader;
  this.components = options.loader.components;

  this._readyPromise = when.resolve();
}

Model.prototype.update = function (frameState) {
  if (!defined(this.drawCommand)) {
    this.drawCommand = createCommand(this, frameState);
  }

  for (var i = 0; i < this.drawCommand.length; i++) {
    frameState.commandList.push(this.drawCommand[i]);
  }
};

function createCommand(model, frameState) {
  var renderState = RenderState.fromCache({
    depthTest: {
      enabled: true,
    },
  });

  return createModelCommands(model.components, frameState, renderState);
}

function createShader(context, attributes, instancingAttributes) {
  var attributeLocations = {};
  var attributeShader = "";

  // Process general vertex attributes (POSITION, NORMAL, FEATURE_ID...)
  var i, j;
  for (i = 0; i < attributes.length; i++) {
    var attribute = attributes[i];
    attributeShader += "attribute vec3 " + attribute.name + ";\n";
    attributeLocations[attribute.name] = attribute.attribute.index;
  }

  if (defined(instancingAttributes)) {
    for (j = 0; j < instancingAttributes.length; j++) {
      var instanceAttribute = instancingAttributes[j];
      attributeShader += "attribute vec3 " + instanceAttribute.name + ";\n";
      attributeLocations[instanceAttribute.name] =
        i + instanceAttribute.attribute.index;
    }
  }

  var vertexShader =
    attributeShader +
    "void main()\n" +
    "{\n" +
    "    vec3 finalPosition = a_position + a_instanceTranslation;\n" +
    "    gl_Position = czm_modelViewProjection * vec4(finalPosition, 1.0);\n" +
    "}\n";

  var fragmentShader =
    "void main()\n" +
    "{\n" +
    "   gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);\n" +
    "}\n";

  return ShaderProgram.fromCache({
    context: context,
    vertexShaderSource: vertexShader,
    fragmentShaderSource: fragmentShader,
    attributeLocations: attributeLocations,
  });
}

function getNodeTransform(node) {
  if (defined(node.matrix)) {
    return Matrix4.fromColumnMajorArray(node.matrix);
  }

  return Matrix4.fromTranslationQuaternionRotationScale(
    defined(node.translation) ? node.translation : new Cartesian3(),
    defined(node.rotation) ? node.rotation : Quaternion.IDENTITY,
    defined(node.scale) ? node.scale : new Cartesian3(1, 1, 1)
  );
}

function getAttributeBySemantic(primitive, semantic) {
  var i;
  var attributes = primitive.attributes;
  var attributesLength = attributes.length;
  for (i = 0; i < attributesLength; ++i) {
    var attribute = attributes[i];
    if (attribute.semantic === semantic) {
      return attribute;
    }
  }
}

function createBoundingSphere(primitive, modelMatrix) {
  // FIXME: Currently assuming that POSITION attribute is always present.
  var positionGltfAttribute = getAttributeBySemantic(primitive, "POSITION");
  var boundingSphere = BoundingSphere.fromCornerPoints(
    positionGltfAttribute.min,
    positionGltfAttribute.max
  );
  boundingSphere.center = Matrix4.getTranslation(modelMatrix, new Cartesian3());
  return boundingSphere;
}

function createAttributes(primitive) {
  // FIXME: Currently assuming that POSITION attribute is always present.
  var positionGltfAttribute = getAttributeBySemantic(primitive, "POSITION");
  var normalGltfAttribute = getAttributeBySemantic(primitive, "NORMAL");
  var featureIdGltfAttribute = getAttributeBySemantic(primitive, "FEATURE_ID");

  var attributeIndex = 0;
  var attributeObjects = [
    {
      name: "a_position",
      attribute: {
        index: attributeIndex++,
        vertexBuffer: positionGltfAttribute.buffer,
        componentsPerAttribute: 3,
        componentDatatype: positionGltfAttribute.componentDatatype,
      },
    },
  ];

  if (defined(normalGltfAttribute)) {
    attributeObjects.push({
      name: "a_normal",
      attribute: {
        index: attributeIndex++,
        vertexBuffer: normalGltfAttribute.buffer,
        componentsPerAttribute: 3,
        componentDatatype: normalGltfAttribute.componentDatatype,
      },
    });
  }

  if (defined(featureIdGltfAttribute)) {
    attributeObjects.push({
      name: "a_featureId",
      attribute: {
        index: attributeIndex++,
        vertexBuffer: featureIdGltfAttribute.buffer,
        componentsPerAttribute: 3,
        componentDatatype: featureIdGltfAttribute.componentDatatype,
      },
    });
  }

  return attributeObjects;
}

function createInstancingAttributes(node) {
  var instanceAttributeIndex = 0;
  var instanceAttributeObjects = [];
  var translationAttribute = getAttributeBySemantic(
    node.instances,
    "TRANSLATION"
  );
  var rotationAttribute = getAttributeBySemantic(node.instances, "ROTATION");
  var scaleAttribute = getAttributeBySemantic(node.instances, "SCALE");

  if (defined(translationAttribute)) {
    instanceAttributeObjects.push({
      name: "a_instanceTranslation",
      attribute: {
        index: instanceAttributeIndex++,
        vertexBuffer: translationAttribute.buffer,
        componentsPerAttribute: 3,
        componentDatatype: ComponentDatatype.FLOAT,
        offsetInBytes: 0,
        strideInBytes: 0,
        instanceDivisor: 1,
      },
    });
  }
  if (defined(rotationAttribute)) {
    instanceAttributeObjects.push({
      name: "a_instanceRotation",
      attribute: {
        index: instanceAttributeIndex++,
        vertexBuffer: rotationAttribute.buffer,
        componentsPerAttribute: 4,
        componentDatatype: ComponentDatatype.FLOAT,
        offsetInBytes: 0,
        strideInBytes: 0,
        instanceDivisor: 1,
      },
    });
  }
  if (defined(scaleAttribute)) {
    instanceAttributeObjects.push({
      name: "a_instanceScale",
      attribute: {
        index: instanceAttributeIndex++,
        vertexBuffer: scaleAttribute.buffer,
        componentsPerAttribute: 3,
        componentDatatype: ComponentDatatype.FLOAT,
        offsetInBytes: 0,
        strideInBytes: 0,
        instanceDivisor: 1,
      },
    });
  }

  return instanceAttributeObjects;
}

function createNodeCommands(node, modelMatrix, frameState, renderState) {
  var drawCommands = [];

  var i;

  var instanceCount = 0;
  var instanceAttributes;

  // Handle EXT_mesh_gpu_instancing
  if (defined(node.instances)) {
    instanceCount = node.instances.attributes[0].count;
    instanceAttributes = createInstancingAttributes(node);
  }

  var primitives = node.primitives;
  for (i = 0; i < primitives.length; i++) {
    var primitive = primitives[i];
    var attributes = createAttributes(primitive);
    var boundingSphere = createBoundingSphere(primitive, modelMatrix);
    var shaderProgram = createShader(
      frameState.context,
      attributes,
      instanceAttributes
    );

    var j;
    var vertexAttributes = [];

    for (j = 0; j < attributes.length; j++) {
      vertexAttributes.push(attributes[j].attribute);
    }

    if (defined(instanceAttributes)) {
      for (j = 0; j < instanceAttributes.length; j++) {
        instanceAttributes[j].attribute.index += attributes.length;
        vertexAttributes.push(instanceAttributes[j].attribute);
      }
    }

    var vertexArray = new VertexArray({
      context: frameState.context,
      attributes: vertexAttributes,
      indexBuffer: primitive.indices.buffer,
    });

    drawCommands.push(
      new DrawCommand({
        boundingVolume: boundingSphere,
        modelMatrix: modelMatrix,
        pass: Pass.OPAQUE,
        shaderProgram: shaderProgram,
        renderState: renderState,
        vertexArray: vertexArray,
        count: primitive.indices.count,
        primitiveType: primitive.primitiveType,
        uniformMap: undefined,
        instanceCount: instanceCount,
      })
    );
  }

  return drawCommands;
}

function createModelCommands(model, frameState, renderState) {
  var drawCommands = [];

  var nodes = model.nodes;
  var nodeStack = [];
  nodeStack.length = 0;

  var i;
  for (i = 0; i < nodes.length; i++) {
    nodeStack.push(nodes[i]);
  }

  while (nodeStack.length > 0) {
    var node = nodeStack.pop();
    var modelMatrix = getNodeTransform(node);
    drawCommands = drawCommands.concat(
      createNodeCommands(node, modelMatrix, frameState, renderState)
    );
  }

  return drawCommands;
}
