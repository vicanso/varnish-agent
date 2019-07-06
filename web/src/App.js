import React from "react";
import { Route, HashRouter } from "react-router-dom";

import AppHeader from "./components/app_header";
import Director from "./components/director";
import UpdateDirector from "./components/update_director";
import AddDirector from "./components/add_director";
import VCLView from "./components/vcl";
import BasicInfo from "./components/basic_info";
import {
  BASIC_INFO_PATH,
  DIRECTOR_PATH,
  UPDATE_DIRECTOR_PATH,
  ADD_DIRECTOR_PATH,
  VCL_PATH
} from "./paths";

class App extends React.Component {
  render() {
    return (
      <div className="App">
        <HashRouter>
          <AppHeader />
          <div>
            <Route path={UPDATE_DIRECTOR_PATH} component={UpdateDirector} />
            <Route exact path={ADD_DIRECTOR_PATH} component={AddDirector} />
            <Route exact path={VCL_PATH} component={VCLView} />
            <Route exact path={DIRECTOR_PATH} component={Director} />
            <Route exact path={BASIC_INFO_PATH} component={BasicInfo} />
          </div>
        </HashRouter>
      </div>
    );
  }
}

export default App;
