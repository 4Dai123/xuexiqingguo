import clone from "../../Core/clone.js";
import defined from "../../Core/defined.js";
import defaultValue from "../../Core/defaultValue.js";
import ModelFeatureTable from "./ModelFeatureTable.js";
import DeveloperError from "../../Core/DeveloperError.js";
import GltfLoader from "../GltfLoader.js";
import ModelExperimentalUtility from "./ModelExperimentalUtility.js";
import ModelExperimentalSceneGraph from "./ModelExperimentalSceneGraph.js";
import Resource from "../../Core/Resource.js";
import when from "../../ThirdParty/when.js";
import RuntimeError from "../Core/RuntimeError.js";
import destroyObject from "../../Core/destroyObject.js";

/**
 * A 3D model based on glTF, the runtime asset format for WebGL. This is
 * a new architecture that is more decoupled than the older {@link Model}.
 *
 * This class is still experimental. glTF features that are core to 3D Tiles
 * are supported, but other features such as animation are not yet supported.
 *
 * @constructor
 *
 * @param {Object} options Object with the following properties:
 * @param {String|Resource|ArrayBuffer|Uint8Array} [options.gltf] A Resource/URL to a glTF/glb file or a binary glTF buffer.
 * @param {Resource|String} [options.basePath=''] The base path that paths in the glTF JSON are relative to.
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY]  The 4x4 transformation matrix that transforms the model from model to world coordinates.
 * @param {Boolean} [options.incrementallyLoadTextures=true] Determine if textures may continue to stream in after the model is loaded.
 * @param {Boolean} [options.releaseGltfJson=false] When true, the glTF JSON is released once the glTF is loaded. This is is especially useful for cases like 3D Tiles, where each .gltf model is unique and caching the glTF JSON is not effective.
 * @param {Boolean} [options.debugShowBoundingVolume=false] For debugging only. Draws the bounding sphere for each draw command in the model.
 *
 * @private
 * @experimental This feature is using part of the 3D Tiles spec that is not final and is subject to change without Cesium's standard deprecation policy.
 */
export default function ModelExperimental(options) {
  options = defaultValue(options, defaultValue.EMPTY_OBJECT);

  this._content = undefined;
  this._featureTable = undefined;
  this._pickObject = undefined;
  /**
   * The glTF Loader used to load resources for this model.
   *
   * @type {GltfLoader}
   * @readonly
   *
   * @private
   */
  this._gltfLoader = undefined;

  this._resourcesLoaded = false;
  this._drawCommandsBuilt = false;

  this._ready = false;
  this._readyPromise = when.defer();

  this._defaultTexture = undefined;
  this._texturesLoaded = false;

  // Keeps track of resources that need to be destroyed when the Model is destroyed.
  this._resources = [];

  this._boundingSphere = undefined;

  this._debugShowBoundingVolumeDirty = false;
  this._debugShowBoundingVolume = defaultValue(
    options.debugShowBoundingVolume,
    false
  );

  initialize(this, options);
}

Object.defineProperties(ModelExperimental.prototype, {
  /**
   * When <code>true</code>, this model is ready to render, i.e., the external binary, image,
   * and shader files were downloaded and the WebGL resources were created.  This is set to
   * <code>true</code> right before {@link ModelExperimental#readyPromise} is resolved.
   *
   * @memberof ModelExperimental.prototype
   *
   * @type {Boolean}
   * @readonly
   *
   * @default false
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },

  /**
   * Gets the promise that will be resolved when this model is ready to render, i.e. when the external resources
   * have been downloaded and the WebGL resources are created.
   * <p>
   * This promise is resolved at the end of the frame before the first frame the model is rendered in.
   * </p>
   *
   * @memberof ModelExperimental.prototype
   *
   * @type {Promise.<ModelExperimental>}
   * @readonly
   */
  readyPromise: {
    get: function () {
      return this._readyPromise.promise;
    },
  },

  /**
   * Gets the model's up axis.
   * By default, models are Y-up according to the glTF 2.0 spec, however, geo-referenced models will typically be Z-up.
   *
   * @memberof ModelExperimental.prototype
   *
   * @type {Number}
   * @default Axis.Y
   * @readonly
   *
   * @private
   */
  upAxis: {
    get: function () {
      return this._sceneGraph._upAxis;
    },
  },

  /**
   * Gets the model's forward axis.
   * By default, glTF 2.0 models are Z-forward according to the spec, however older
   * glTF (1.0, 0.8) models used X-forward. Note that only Axis.X and Axis.Z are supported.
   *
   * @memberof ModelExperimental.prototype
   *
   * @type {Number}
   * @default Axis.Z
   * @readonly
   *
   * @private
   */
  forwardAxis: {
    get: function () {
      return this._sceneGraph._forwardAxis;
    },
  },

  /**
   * Gets the model's bounding sphere.
   *
   * @memberof ModelExperimental.prototype
   *
   * @type {BoundingSphere}
   * @readonly
   *
   * @private
   */
  boundingSphere: {
    get: function () {
      //>>includeStart('debug', pragmas.debug);
      if (!this._ready) {
        throw new DeveloperError(
          "The model is not loaded. Use ModelExperimental.readyPromise or wait for ModelExperimental.ready to be true."
        );
      }
      //>>includeEnd('debug');

      return this._sceneGraph._boundingSphere;
    },
  },

  /**
   * This property is for debugging only; it is not for production use nor is it optimized.
   * <p>
   * Draws the bounding sphere for each draw command in the model.  A glTF primitive corresponds
   * to one draw command.  A glTF mesh has an array of primitives, often of length one.
   * </p>
   *
   * @memberof ModelExperimental.prototype
   *
   * @type {Boolean}
   *
   * @default false
   */
  debugShowBoundingVolume: {
    get: function () {
      return this._debugShowBoundingVolume;
    },
    set: function (value) {
      if (this._debugShowBoundingVolume !== value) {
        this._debugShowBoundingVolumeDirty = true;
      }
      this._debugShowBoundingVolume = value;
    },
  },
});

/**
 * Called when {@link Viewer} or {@link CesiumWidget} render the scene to
 * get the draw commands needed to render this primitive.
 * <p>
 * Do not call this function directly.  This is documented just to
 * list the exceptions that may be propagated when the scene is rendered:
 * </p>
 *
 * @exception {RuntimeError} Failed to load external reference.
 */
ModelExperimental.prototype.update = function (frameState) {
  if (!defined(this._defaultTexture)) {
    this._defaultTexture = frameState.context.defaultTexture;
  }

  // Keep processing the glTF every frame until the main resources
  // (buffer views) and textures (which may be loaded asynchronously)
  // are processed.
  if (!this._resourcesLoaded || !this._texturesLoaded) {
    this._gltfLoader.process(frameState);
  }

  // short-circuit if the glTF resources aren't ready.
  if (!this._resourcesLoaded) {
    return;
  }

  if (!this._drawCommandsBuilt) {
    this._sceneGraph.buildDrawCommands(frameState);
    this._drawCommandsBuilt = true;

    var model = this;
    // Set the model as ready after the first frame render since the user might set up events subscribed to
    // the post render event, and the model may not be ready for those past the first frame.
    frameState.afterRender.push(function () {
      model._ready = true;
      model._readyPromise.resolve(model);
    });
  }

  if (this._debugShowBoundingVolumeDirty) {
    updateShowBoundingVolume(this._sceneGraph, this._debugShowBoundingVolume);
    this._debugShowBoundingVolumeDirty = false;
  }

  if (defined(this._featureTable)) {
    this._featureTable.update(frameState);
  }

  frameState.commandList.push.apply(
    frameState.commandList,
    this._sceneGraph._drawCommands
  );
};

/**
 * Returns true if this object was destroyed; otherwise, false.
 * <br /><br />
 * If this object was destroyed, it should not be used; calling any function other than
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
 *
 * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
 *
 * @see ModelExperimental#destroy
 */
ModelExperimental.prototype.isDestroyed = function () {
  return false;
};

/**
 * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
 * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
 * <br /><br />
 * Once an object is destroyed, it should not be used; calling any function other than
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * assign the return value (<code>undefined</code>) to the object as done in the example.
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 *
 * @example
 * model = model && model.destroy();
 *
 * @see ModelExperimental#isDestroyed
 */
ModelExperimental.prototype.destroy = function () {
  var gltfLoader = this._gltfLoader;
  if (defined(gltfLoader)) {
    gltfLoader.destroy();
  }

  var resources = this._resources;
  for (var i = 0; i < resources.length; i++) {
    resources[i].destroy();
  }

  destroyObject(this);
};

function initialize(model, options) {
  model._content = options.content;
  model._pickObject = options.pickObject;

  var gltf = options.gltf;

  var loaderOptions = {
    baseResource: options.basePath,
    releaseGltfJson: options.releaseGltfJson,
    incrementallyLoadTextures: options.incrementallyLoadTextures,
  };

  if (gltf instanceof Uint8Array) {
    loaderOptions.typedArray = gltf;
    loaderOptions.gltfResource = Resource.createIfNeeded(
      defaultValue(options.basePath, "")
    );
  } else {
    loaderOptions.gltfResource = gltf;
  }

  var loader = new GltfLoader(loaderOptions);
  model._gltfLoader = loader;
  loader.load();

  loader.promise
    .then(function (loader) {
      var components = loader._components;
      model._sceneGraph = new ModelExperimentalSceneGraph({
        model: model,
        modelComponents: components,
        upAxis: options.upAxis,
        forwardAxis: options.forwardAxis,
        allowPicking: options.allowPicking,
        modelMatrix: options.modelMatrix,
      });

      if (defined(components.featureMetadata)) {
        createFeatureTable(model);
      }

      model._resourcesLoaded = true;
    })
    .otherwise(function () {
      ModelExperimentalUtility.getFailedLoadFunction(
        this,
        "model",
        options.basePath
      );
    });

  loader.texturesLoadedPromise
    .then(function () {
      model._texturesLoaded = true;
    })
    .otherwise(function () {
      ModelExperimentalUtility.getFailedLoadFunction(
        this,
        "model",
        options.basePath
      );
    });
}

/**
 *
 * @param {Object} options Object with the following properties:
 * @param {Resource|String} options.url The url to the .gltf or .glb file.
 * @param {Object} [options.basePath=''] The base path that paths in the glTF JSON are relative to.
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] The 4x4 transformation matrix that transforms the model from model to world coordinates.
 * @param {Boolean} [options.incrementallyLoadTextures=true] Determine if textures may continue to stream in after the model is loaded.
 * @param {Boolean} [options.releaseGltfJson=false] When true, the glTF JSON is released once the glTF is loaded. This is is especially useful for cases like 3D Tiles, where each .gltf model is unique and caching the glTF JSON is not effective.
 * @param {Boolean} [options.debugShowBoundingVolume=false] For debugging only. Draws the bounding sphere for each draw command in the model.
 */
ModelExperimental.fromGltf = function (options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(options) || !defined(options.url)) {
    throw new DeveloperError("options.url is required");
  }
  //>>includeEnd('debug');

  options = clone(options);
  options.gltf = Resource.createIfNeeded(options.url);
  var model = new ModelExperimental(options);
  return model;
};

function updateShowBoundingVolume(sceneGraph, debugShowBoundingVolume) {
  var drawCommands = sceneGraph._drawCommands;
  for (var i = 0; i < drawCommands.length; i++) {
    drawCommands[i].debugShowBoundingVolume = debugShowBoundingVolume;
  }
}

function createFeatureTable(model) {
  var featureMetadata = model._sceneGraph._modelComponents.featureMetadata;
  var featureTableCount = featureMetadata.featureTableCount;

  if (featureTableCount === 0) {
    return undefined;
  }

  if (featureTableCount > 1) {
    throw new RuntimeError(
      "Only one feature table supported for glTF EXT_feature_metadata"
    );
  }

  var featureTables = featureMetadata._featureTables;
  var featureTable;
  for (var featureTableId in featureTables) {
    if (featureTables.hasOwnProperty(featureTableId)) {
      featureTable = featureTables[featureTableId];
    }
  }

  model._featureTable = new ModelFeatureTable(model, featureTable);
}
