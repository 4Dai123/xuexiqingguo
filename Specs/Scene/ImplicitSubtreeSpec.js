import {
  ImplicitSubtree,
  ImplicitTileset,
  Resource,
  when,
} from "../../Source/Cesium.js";
import ImplicitTilingTester from "../ImplicitTilingTester.js";

describe("Scene/ImplicitSubtree", function () {
  function availabilityToBooleanArray(availability) {
    if (typeof availability.descriptor === "number") {
      var constant = availability.descriptor === 1;
      var repeated = new Array(availability.lengthBits);
      for (var i = 0; i < availability.lengthBits; i++) {
        repeated[i] = constant;
      }
      return repeated;
    }

    return availability.descriptor.split("").map(function (x) {
      return x === "1";
    });
  }

  function expectTileAvailability(subtree, availability) {
    var expectedAvailability = availabilityToBooleanArray(availability);
    for (var i = 0; i < availability.lengthBits; i++) {
      expect(subtree.tileIsAvailable(i)).toEqual(expectedAvailability[i]);
    }
  }

  function expectContentAvailability(subtree, availability) {
    var expectedAvailability = availabilityToBooleanArray(availability);
    for (var i = 0; i < availability.lengthBits; i++) {
      expect(subtree.contentIsAvailable(i)).toEqual(expectedAvailability[i]);
    }
  }

  function expectChildSubtreeAvailability(subtree, availability) {
    var expectedAvailability = availabilityToBooleanArray(availability);
    for (var i = 0; i < availability.lengthBits; i++) {
      expect(subtree.childSubtreeIsAvailable(i)).toEqual(
        expectedAvailability[i]
      );
    }
  }

  var tilesetResource = new Resource({
    url: "https://example.com/tileset.json",
  });
  var subtreeResource = new Resource({
    url: "https://example.com/test.subtree",
  });
  var implicitQuadtree = new ImplicitTileset(tilesetResource, {
    geometricError: 500,
    refine: "ADD",
    boundingVolume: {
      region: [0, 0, Math.PI / 24, Math.PI / 24, 0, 1000.0],
    },
    content: {
      uri: "https://example.com/{level}/{x}/{y}.b3dm",
    },
    extensions: {
      "3DTILES_implicit_tiling": {
        subdivisionScheme: "QUADTREE",
        subtreeLevels: 2,
        maximumLevel: 1,
        subtrees: {
          uri: "https://example.com/{level}/{x}/{y}.subtree",
        },
      },
    },
  });
  var implicitOctree = new ImplicitTileset(tilesetResource, {
    geometricError: 500,
    refine: "REPLACE",
    boundingVolume: {
      region: [0, 0, Math.PI / 24, Math.PI / 24, 0, 1000.0],
    },
    content: {
      uri: "https://example.com/{level}/{x}_{y}_{z}.b3dm",
    },
    extensions: {
      "3DTILES_implicit_tiling": {
        subdivisionScheme: "OCTREE",
        subtreeLevels: 2,
        maximumLevel: 3,
        subtrees: {
          uri: "https://example.com/{level}/{x}_{y}_{z}.subtree",
        },
      },
    },
  });

  it("gets availability from internal buffer", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: "11010",
        lengthBits: 5,
        isInternal: true,
      },
      contentAvailability: {
        descriptor: "11000",
        lengthBits: 5,
        isInternal: true,
      },
      childSubtreeAvailability: {
        descriptor: "1111000010100000",
        lengthBits: 16,
        isInternal: true,
      },
    };

    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription
    );
    var subtree = new ImplicitSubtree(
      subtreeResource,
      results.subtreeBuffer,
      implicitQuadtree
    );
    return subtree.readyPromise.then(function () {
      expectTileAvailability(subtree, subtreeDescription.tileAvailability);
      expectContentAvailability(
        subtree,
        subtreeDescription.contentAvailability
      );
      expectChildSubtreeAvailability(
        subtree,
        subtreeDescription.childSubtreeAvailability
      );
    });
  });

  it("gets availability from external buffer", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: "11010",
        lengthBits: 5,
        isInternal: false,
      },
      contentAvailability: {
        descriptor: "11000",
        lengthBits: 5,
        isInternal: false,
      },
      childSubtreeAvailability: {
        descriptor: "1111000010100000",
        lengthBits: 16,
        isInternal: false,
      },
    };
    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription
    );

    var fetchExternal = spyOn(
      Resource.prototype,
      "fetchArrayBuffer"
    ).and.returnValue(when.resolve(results.externalBuffer));
    var subtree = new ImplicitSubtree(
      subtreeResource,
      results.subtreeBuffer,
      implicitQuadtree
    );
    return subtree.readyPromise.then(function () {
      expectTileAvailability(subtree, subtreeDescription.tileAvailability);
      expectContentAvailability(
        subtree,
        subtreeDescription.contentAvailability
      );
      expectChildSubtreeAvailability(
        subtree,
        subtreeDescription.childSubtreeAvailability
      );

      expect(fetchExternal.calls.count()).toEqual(1);
    });
  });

  it("handles typed arrays with a byte offset", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: "11010",
        lengthBits: 5,
        isInternal: true,
      },
      contentAvailability: {
        descriptor: "11000",
        lengthBits: 5,
        isInternal: true,
      },
      childSubtreeAvailability: {
        descriptor: "1111000010100000",
        lengthBits: 16,
        isInternal: true,
      },
    };

    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription
    );

    // Put the subtree buffer in a larger buffer so the byteOffset is not 0
    var paddingLength = 8;
    var biggerBuffer = new Uint8Array(
      results.subtreeBuffer.length + paddingLength
    );
    biggerBuffer.set(results.subtreeBuffer, paddingLength);
    var subtreeView = new Uint8Array(biggerBuffer.buffer, paddingLength);

    var subtree = new ImplicitSubtree(
      subtreeResource,
      subtreeView,
      implicitQuadtree
    );
    return subtree.readyPromise.then(function () {
      expectTileAvailability(subtree, subtreeDescription.tileAvailability);
      expectContentAvailability(
        subtree,
        subtreeDescription.contentAvailability
      );
      expectChildSubtreeAvailability(
        subtree,
        subtreeDescription.childSubtreeAvailability
      );
    });
  });

  it("tile and content availability can share the same buffer", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: "11010",
        lengthBits: 5,
        isInternal: false,
      },
      contentAvailability: {
        shareBuffer: true,
        descriptor: "11010",
        lengthBits: 5,
        isInternal: false,
      },
      childSubtreeAvailability: {
        descriptor: "1111000010100000",
        lengthBits: 16,
        isInternal: false,
      },
    };
    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription
    );

    var fetchExternal = spyOn(
      Resource.prototype,
      "fetchArrayBuffer"
    ).and.returnValue(when.resolve(results.externalBuffer));
    var subtree = new ImplicitSubtree(
      subtreeResource,
      results.subtreeBuffer,
      implicitQuadtree
    );
    return subtree.readyPromise.then(function () {
      expectTileAvailability(subtree, subtreeDescription.tileAvailability);
      expectContentAvailability(
        subtree,
        subtreeDescription.contentAvailability
      );
      expectChildSubtreeAvailability(
        subtree,
        subtreeDescription.childSubtreeAvailability
      );
      expect(fetchExternal.calls.count()).toEqual(1);
    });
  });

  it("external buffer is fetched if it is used for availability", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: 1,
        lengthBits: 5,
        isInternal: false,
      },
      contentAvailability: {
        descriptor: "11000",
        lengthBits: 5,
        isInternal: false,
      },
      childSubtreeAvailability: {
        descriptor: "1111000010100000",
        lengthBits: 16,
        isInternal: false,
      },
    };
    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription
    );

    var fetchExternal = spyOn(
      Resource.prototype,
      "fetchArrayBuffer"
    ).and.returnValue(when.resolve(results.externalBuffer));
    var subtree = new ImplicitSubtree(
      subtreeResource,
      results.subtreeBuffer,
      implicitQuadtree
    );
    return subtree.readyPromise.then(function () {
      expect(fetchExternal.calls.count()).toEqual(1);
    });
  });

  it("unused external buffers are not fetched", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: 1,
        lengthBits: 5,
        isInternal: true,
      },
      contentAvailability: {
        descriptor: "11000",
        lengthBits: 5,
        isInternal: true,
      },
      childSubtreeAvailability: {
        descriptor: "1111000010100000",
        lengthBits: 16,
        isInternal: true,
      },
      other: {
        descriptor: "101010",
        lengthBits: 6,
        isInternal: false,
      },
    };
    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription
    );

    var fetchExternal = spyOn(
      Resource.prototype,
      "fetchArrayBuffer"
    ).and.returnValue(when.resolve(results.externalBuffer));
    var subtree = new ImplicitSubtree(
      subtreeResource,
      results.subtreeBuffer,
      implicitQuadtree
    );
    return subtree.readyPromise.then(function () {
      expect(fetchExternal).not.toHaveBeenCalled();
    });
  });

  it("missing contentAvailability is interpreted as 0s", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: "11010",
        lengthBits: 5,
        isInternal: true,
      },
      childSubtreeAvailability: {
        descriptor: "1111000010100000",
        lengthBits: 16,
        isInternal: true,
      },
    };
    var expectedContentAvailability = {
      descriptor: 0,
      lengthBits: 5,
      isInternal: true,
    };

    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription
    );

    var subtree = new ImplicitSubtree(
      subtreeResource,
      results.subtreeBuffer,
      implicitQuadtree
    );
    return subtree.readyPromise.then(function () {
      expectTileAvailability(subtree, subtreeDescription.tileAvailability);
      expectContentAvailability(subtree, expectedContentAvailability);
      expectChildSubtreeAvailability(
        subtree,
        subtreeDescription.childSubtreeAvailability
      );
    });
  });

  it("availability works for quadtrees", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: 1,
        lengthBits: 5,
        isInternal: true,
      },
      contentAvailability: {
        descriptor: 1,
        lengthBits: 5,
        isInternal: true,
      },
      childSubtreeAvailability: {
        descriptor: 0,
        lengthBits: 16,
        isInternal: true,
      },
    };

    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription
    );
    var subtree = new ImplicitSubtree(
      subtreeResource,
      results.subtreeBuffer,
      implicitQuadtree
    );
    return subtree.readyPromise.then(function () {
      expectTileAvailability(subtree, subtreeDescription.tileAvailability);
      expectContentAvailability(
        subtree,
        subtreeDescription.contentAvailability
      );
      expectChildSubtreeAvailability(
        subtree,
        subtreeDescription.childSubtreeAvailability
      );
    });
  });

  it("availability works for octrees", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: "110101111",
        lengthBits: 9,
        isInternal: true,
      },
      contentAvailability: {
        descriptor: "110101011",
        lengthBits: 9,
        isInternal: true,
      },
      childSubtreeAvailability: {
        descriptor: 1,
        lengthBits: 64,
        isInternal: true,
      },
    };

    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription
    );
    var subtree = new ImplicitSubtree(
      subtreeResource,
      results.subtreeBuffer,
      implicitOctree
    );
    return subtree.readyPromise.then(function () {
      expectTileAvailability(subtree, subtreeDescription.tileAvailability);
      expectContentAvailability(
        subtree,
        subtreeDescription.contentAvailability
      );
      expectChildSubtreeAvailability(
        subtree,
        subtreeDescription.childSubtreeAvailability
      );
    });
  });

  it("handles subtree with constant-only data", function () {
    var subtreeDescription = {
      tileAvailability: {
        descriptor: 1,
        lengthBits: 9,
        isInternal: true,
      },
      contentAvailability: {
        descriptor: 0,
        lengthBits: 9,
        isInternal: true,
      },
      childSubtreeAvailability: {
        descriptor: 0,
        lengthBits: 64,
        isInternal: true,
      },
    };

    var constantOnly = true;
    var results = ImplicitTilingTester.generateSubtreeBuffers(
      subtreeDescription,
      constantOnly
    );
    var subtree = new ImplicitSubtree(
      subtreeResource,
      results.subtreeBuffer,
      implicitOctree
    );
    return subtree.readyPromise.then(function () {
      expectTileAvailability(subtree, subtreeDescription.tileAvailability);
      expectContentAvailability(
        subtree,
        subtreeDescription.contentAvailability
      );
      expectChildSubtreeAvailability(
        subtree,
        subtreeDescription.childSubtreeAvailability
      );
    });
  });
});
