import React from 'react';
import { Box, Text } from 'ink';
import cfonts from 'cfonts';

export function Welcome() {
  const rendered = cfonts.render("POSTT", {
    font: "block",
    colors: ["white", "#FF5C00"],
    background: "transparent",
    space: false,
    maxLength: "0",
    gradient: false,
    independentGradient: false,
    transitionGradient: false,
    env: "node",
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text>{rendered && rendered.string}</Text>
      <Box paddingX={1}>
        <Text color="gray">Lightning fast blogging from your terminal.</Text>
      </Box>
      <Text> </Text>
      <Box paddingX={1}>
        <Text>Let's set up your blog in a few quick steps.</Text>
      </Box>
    </Box>
  );
}
