import AddUpdateDirector from "./add_update_director";
import request from "../request";

import { DIRECTORS } from "../urls";

class AddDirector extends AddUpdateDirector {
  constructor() {
    super();
    this.state.type = "add";
    this.state.inited = true;
  }
  submit(data) {
    return request.post(DIRECTORS, data);
  }
}

export default AddDirector;
