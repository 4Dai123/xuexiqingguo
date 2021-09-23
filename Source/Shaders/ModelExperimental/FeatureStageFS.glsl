void featureStage(inout FeatureIdentification feature)
{
    #ifdef FEATURE_ID_TEXTURE
    float featureId = floor(texture2D(FEATURE_ID_TEXTURE, FEATURE_ID_TEXCOORD).FEATURE_ID_CHANNEL * 255.0 + 0.5);
    if (featureId < model_featuresLength)
    {
        feature.id = featureId;
        feature.st = computeSt(featureId);
    }
    // Floating point comparisons can be unreliable in GLSL, so we
    // increment the v_featureId to make sure it's always greater
    // then the model_featuresLength - a condition we check for in the
    // pick ID, to avoid sampling the pick texture if the feature ID is
    // greater than the number of features.
    else
    {
        feature.id = model_featuresLength + 1.0;
    }
    #else
    setFeatureIdentificationVaryings(feature);
    #endif
}
