import React from "react";

import Component from "ts-lib-template";

export default () => {

  const instance = React.useRef<Component>(() => {
    return new Component();
  }).current;

  return (
    <h1>
      typeof instance: {typeof instance}
    </h1>
  );
};
