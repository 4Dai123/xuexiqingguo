import { MetadataClass, MetadataTileset } from "../../Source/Cesium.js";

describe("Scene/MetadataTileset", function () {
  it("creates tileset metadata with default values", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });

    expect(tilesetMetadata.class).toBeUndefined();
    expect(tilesetMetadata.properties).toEqual({});
    expect(tilesetMetadata.name).toBeUndefined();
    expect(tilesetMetadata.description).toBeUndefined();
    expect(tilesetMetadata.extras).toBeUndefined();
  });

  it("creates tileset metadata", function () {
    var cityClass = new MetadataClass({
      id: "city",
      class: {
        properties: {
          neighborhoods: {
            type: "ARRAY",
            componentType: "STRING",
          },
        },
      },
    });

    var extras = {
      other: 0,
    };

    var extensions = {
      EXT_other_extension: {},
    };

    var properties = {
      neighborhoods: ["A", "B", "C"],
    };

    var tilesetMetadata = new MetadataTileset({
      class: cityClass,
      tileset: {
        name: "City",
        description: "City Metadata",
        extras: extras,
        extensions: extensions,
        properties: properties,
      },
    });

    expect(tilesetMetadata.class).toBe(cityClass);
    expect(tilesetMetadata.name).toBe("City");
    expect(tilesetMetadata.description).toBe("City Metadata");
    expect(tilesetMetadata.extras).toBe(extras);
    expect(tilesetMetadata.extensions).toBe(extensions);
    expect(tilesetMetadata.properties).toBe(properties);
  });

  it("constructor throws without tileset", function () {
    expect(function () {
      return new MetadataTileset();
    }).toThrowDeveloperError();
  });

  it("hasProperty returns false when there's no properties", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });
    expect(tilesetMetadata.hasProperty("height")).toBe(false);
  });

  it("hasProperty returns false when there's no property with the given property ID", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
        },
      },
    });
    expect(tilesetMetadata.hasProperty("color")).toBe(false);
  });

  it("hasProperty returns true when there's a property with the given property ID", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
        },
      },
    });
    expect(tilesetMetadata.hasProperty("height")).toBe(true);
  });

  it("hasProperty returns true when the class has a default value for a missing property", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
            optional: true,
            default: 10.0,
          },
        },
      },
    });
    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {},
    });

    expect(tilesetMetadata.hasProperty("height")).toBe(true);
  });

  it("hasProperty throws without propertyId", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });

    expect(function () {
      tilesetMetadata.hasProperty();
    }).toThrowDeveloperError();
  });

  it("getPropertyIds returns empty array when there are no properties", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });

    expect(tilesetMetadata.getPropertyIds().length).toBe(0);
  });

  it("getPropertyIds returns array of property IDs", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
          },
          color: {
            type: "STRING",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
          color: "RED",
        },
      },
    });

    expect(tilesetMetadata.getPropertyIds().sort()).toEqual([
      "color",
      "height",
    ]);
  });

  it("getPropertyIds includes properties with default values", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
            optional: true,
            default: 10.0,
          },
          color: {
            type: "STRING",
          },
        },
      },
    });
    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          color: "RED",
        },
      },
    });

    expect(tilesetMetadata.getPropertyIds().sort()).toEqual([
      "color",
      "height",
    ]);
  });

  it("getPropertyIds uses results argument", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
          },
          color: {
            type: "STRING",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
          color: "RED",
        },
      },
    });

    var results = [];
    var returnedResults = tilesetMetadata.getPropertyIds(results);

    expect(results).toBe(returnedResults);
    expect(results.sort()).toEqual(["color", "height"]);
  });

  it("getProperty returns undefined when there's no properties", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });
    expect(tilesetMetadata.getProperty("height")).toBeUndefined();
  });

  it("getProperty returns undefined when there's no property with the given property ID", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
        },
      },
    });
    expect(tilesetMetadata.getProperty("color")).toBeUndefined();
  });

  it("getProperty returns the property value", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          position: {
            type: "ARRAY",
            componentType: "FLOAT32",
            componentCount: 3,
          },
        },
      },
    });

    var position = [0.0, 0.0, 0.0];

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          position: position,
        },
      },
    });

    var value = tilesetMetadata.getProperty("position");
    expect(value).toEqual(position);
    expect(value).not.toBe(position); // The value is cloned
  });

  it("getProperty returns the default value when the property is missing", function () {
    var position = [0.0, 0.0, 0.0];
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          position: {
            type: "ARRAY",
            componentType: "FLOAT32",
            componentCount: 3,
            optional: true,
            default: position,
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {},
    });

    var value = tilesetMetadata.getProperty("position");
    expect(value).toEqual(position);
    expect(value).not.toBe(position); // The value is cloned
  });

  it("getProperty throws without propertyId", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });

    expect(function () {
      tilesetMetadata.getProperty();
    }).toThrowDeveloperError();
  });

  it("setProperty creates property if it doesn't exist", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });

    var position = [0.0, 0.0, 0.0];
    tilesetMetadata.setProperty("position", position);
    expect(tilesetMetadata.properties.position).toEqual(position);
    expect(tilesetMetadata.properties.position).not.toBe(position); // The value is cloned
  });

  it("setProperty sets property value", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          position: {
            type: "ARRAY",
            componentType: "FLOAT32",
            componentCount: 3,
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          position: [0.0, 0.0, 0.0],
        },
      },
    });

    var position = [1.0, 1.0, 1.0];
    tilesetMetadata.setProperty("position", position);
    expect(tilesetMetadata.properties.position).toEqual(position);
    expect(tilesetMetadata.properties.position).not.toBe(position); // The value is cloned
  });

  it("setProperty throws without propertyId", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });

    expect(function () {
      tilesetMetadata.setProperty();
    }).toThrowDeveloperError();
  });

  it("setProperty throws without value", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });

    expect(function () {
      tilesetMetadata.setProperty("color");
    }).toThrowDeveloperError();
  });

  it("getPropertyBySemantic returns undefined when there's no class", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });
    expect(tilesetMetadata.getPropertyBySemantic("_HEIGHT")).toBeUndefined();
  });

  it("getPropertyBySemantic returns undefined when there's no property with the given semantic", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
        },
      },
    });

    expect(tilesetMetadata.getPropertyBySemantic("_HEIGHT")).toBeUndefined();
  });

  it("getPropertyBySemantic returns the property value", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
            semantic: "_HEIGHT",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
        },
      },
    });

    expect(tilesetMetadata.getPropertyBySemantic("_HEIGHT")).toBe(10.0);
  });

  it("getPropertyBySemantic throws without semantic", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });

    expect(function () {
      tilesetMetadata.getPropertyBySemantic();
    }).toThrowDeveloperError();
  });

  it("setPropertyBySemantic sets property value", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
            semantic: "_HEIGHT",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
        },
      },
    });

    tilesetMetadata.setPropertyBySemantic("_HEIGHT", 20.0);
    expect(tilesetMetadata.properties.height).toBe(20.0);
  });

  it("setPropertyBySemantic doesn't set property value when there's no matching semantic", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
        },
      },
    });

    tilesetMetadata.setPropertyBySemantic("_HEIGHT", 20.0);
    expect(tilesetMetadata.properties.height).toBe(10.0);
  });

  it("setPropertyBySemantic throws without semantic", function () {
    var tilesetMetadata = new MetadataTileset({
      tileset: {},
    });

    expect(function () {
      tilesetMetadata.setPropertyBySemantic();
    }).toThrowDeveloperError();
  });

  it("setPropertyBySemantic throws without value", function () {
    var buildingClass = new MetadataClass({
      id: "building",
      class: {
        properties: {
          height: {
            type: "FLOAT32",
            semantic: "_HEIGHT",
          },
        },
      },
    });

    var tilesetMetadata = new MetadataTileset({
      class: buildingClass,
      tileset: {
        properties: {
          height: 10.0,
        },
      },
    });

    expect(function () {
      tilesetMetadata.setPropertyBySemantic("_HEIGHT");
    }).toThrowDeveloperError();
  });
});
