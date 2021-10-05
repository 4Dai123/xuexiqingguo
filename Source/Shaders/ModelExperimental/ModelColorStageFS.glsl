void modelColorStage(inout vec3 diffuse, inout float alpha)
{
    if (model_colorBlend == 0.0)
    {
        float highlight = ceil(model_colorBlend);
        diffuse *= mix(model_color.rgb, vec3(1.0), highlight);
        alpha *= model_color.a;
    }
}
